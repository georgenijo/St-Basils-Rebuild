import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

import { formatFiles } from './checks'
import { EDIT_TOOLS, runClaude } from './claude'
import { selectRequiredCiConclusion } from './ci-status'
import type { Config } from './config'
import {
  deleteVerificationFiles,
  downloadFile,
  getFiles,
  getMessages,
  getRequest,
  postMessage,
  postMessageSafe,
  updateRequest,
  type Db,
} from './db'
import {
  changedFiles,
  commit,
  ensureClone,
  ensureDependencies,
  git,
  prepareBranch,
  pushBranch,
  stageAll,
} from './git'
import type { GitHub } from './github'
import {
  countChangedLines,
  evaluateChangeSet,
  evaluateGuardrails,
  unreferencedAttachments,
} from './guardrails'
import { log, redact } from './log'
import { attachmentDisplayName, branchName, safeFilename, shortId } from './naming'
import { notify } from './notify'
import { buildPrBody, buildVerdictComment } from './prbody'
import { selectPreviewDeployment } from './preview'
import { buildAgentPrompt, buildRepairPrompt, parseAgentResult } from './prompt'
import { prTitle, redactPublic } from './redact'
import {
  agentCheckoutDir,
  applyChanges,
  createAgentCheckout,
  diffSnapshots,
  removeAgentCheckout,
  snapshotTree,
  type Snapshot,
} from './sandbox'
import type { ChangeRequest, PlacedAttachment, VerificationResult } from './types'
import { hardChecksPass, verifyPreview } from './verify'

export interface JobContext {
  config: Config
  db: Db
  gh: GitHub
  secrets: string[]
  isShuttingDown: () => boolean
}

export class ShutdownError extends Error {
  constructor() {
    super('Worker is shutting down')
  }
}

/** A handled stop: the request already has its final status and messages. */
class Stop extends Error {}

function checkpoint(ctx: JobContext): void {
  if (ctx.isShuttingDown()) throw new ShutdownError()
}

function humanError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return redact(message).slice(0, 1000)
}

const TEXT_EXT = /\.(tsx?|css|svg|txt)$/i

// ─── attachments ────────────────────────────────────────────────────────

/** Download attachments into the agent checkout (the agent cannot write binaries). */
async function placeAttachments(
  ctx: JobContext,
  request: ChangeRequest,
  agentDir: string
): Promise<PlacedAttachment[]> {
  const rows = await getFiles(ctx.db, request.id, 'attachment')
  if (rows.length === 0) return []
  const relDir = path.posix.join('public', 'images', 'requests', shortId(request.id))
  const absDir = path.join(agentDir, relDir)
  await fs.mkdir(absDir, { recursive: true })
  const used = new Set<string>()
  const placed: PlacedAttachment[] = []
  for (const row of rows) {
    const display = attachmentDisplayName(row.storage_path, row.filename)
    let name = safeFilename(display)
    for (let i = 2; used.has(name); i++)
      name = safeFilename(display).replace(/(\.[a-z0-9]+)?$/, `-${i}$1`)
    used.add(name)
    const data = await downloadFile(ctx.db, row.storage_path)
    await fs.writeFile(path.join(absDir, name), data, { mode: 0o644 })
    const repoPath = path.posix.join(relDir, name)
    placed.push({
      filename: display,
      repoPath,
      publicPath: `/${repoPath.replace(/^public\//, '')}`,
      contentType: row.content_type,
    })
  }
  log.info('attachments placed', { requestId: request.id, files: placed.map((p) => p.repoPath) })
  return placed
}

// ─── guardrails ─────────────────────────────────────────────────────────

interface GuardedChange {
  files: string[]
  changedLines: number
  patch: string
  keptAttachments: PlacedAttachment[]
}

class GuardrailError extends Error {}

interface Workspace {
  agentDir: string
  baseSnapshot: Snapshot
  attachments: PlacedAttachment[]
}

/**
 * Validate the agent's sandbox changes, then reset the trusted checkout to
 * the base commit and copy in only the validated files. Nothing the agent
 * wrote reaches the trusted checkout (where tooling runs) before this passes.
 */
async function syncValidatedChanges(ctx: JobContext, ws: Workspace): Promise<GuardedChange> {
  const trusted = ctx.config.workDir
  let changes = diffSnapshots(ws.baseSnapshot, await snapshotTree(ws.agentDir))

  const readText = async (p: string) => fs.readFile(path.join(ws.agentDir, p), 'utf8')
  const texts = new Map<string, string>()
  for (const c of changes) {
    if (c.change !== 'deleted' && c.kind === 'file' && TEXT_EXT.test(c.path)) {
      texts.set(c.path, await readText(c.path))
    }
  }
  const unused = unreferencedAttachments(
    ws.attachments.filter((a) => changes.some((c) => c.path === a.repoPath)),
    texts
  )
  if (unused.length) {
    for (const a of unused) await fs.rm(path.join(ws.agentDir, a.repoPath), { force: true })
    const drop = new Set(unused.map((a) => a.repoPath))
    changes = changes.filter((c) => !drop.has(c.path))
    log.info('removed unreferenced attachments', { files: [...drop] })
  }

  const verdict = evaluateChangeSet(changes, texts)
  if (!verdict.ok) throw new GuardrailError(verdict.reason)

  await resetTrusted(ctx)
  await applyChanges(ws.agentDir, trusted, changes)

  // Anything git would ignore must not sit silently in the trusted checkout.
  const written = changes.filter((c) => c.change !== 'deleted').map((c) => c.path)
  if (written.length) {
    const ignored = (
      await git(trusted, [
        'ls-files',
        '-z',
        '--others',
        '--ignored',
        '--exclude-standard',
        '--',
        ...written,
      ])
    )
      .split('\0')
      .filter(Boolean)
    if (ignored.length) {
      throw new GuardrailError(`The change includes files ignored by git: ${ignored.join(', ')}`)
    }
  }
  const change = await stagedChange(ctx, ws.attachments)
  log.info('validated changes copied to trusted checkout', {
    files: change.files,
    changedLines: change.changedLines,
  })
  return change
}

/** Guardrail pass on exactly what is staged in the trusted checkout. */
async function stagedChange(
  ctx: JobContext,
  attachments: PlacedAttachment[]
): Promise<GuardedChange> {
  const trusted = ctx.config.workDir
  const staged = await stageAll(trusted)
  const files = await changedFiles(trusted)
  const changedLines = countChangedLines(staged.numstat)
  const verdict = evaluateGuardrails({
    files,
    changedLines,
    maxDiffLines: ctx.config.maxDiffLines,
    diffText: staged.patch,
    secrets: ctx.secrets,
  })
  if (!verdict.ok) throw new GuardrailError(verdict.reason)
  return {
    files: files.map((f) => f.path),
    changedLines,
    patch: staged.patch,
    keptAttachments: attachments.filter((a) => existsSync(path.join(trusted, a.repoPath))),
  }
}

// ─── status helpers ─────────────────────────────────────────────────────

async function needsAttention(
  ctx: JobContext,
  requestId: string,
  error: string,
  message: string,
  extra: Parameters<typeof updateRequest>[2] = {}
): Promise<void> {
  await updateRequest(ctx.db, requestId, { ...extra, status: 'needs_attention', error })
  await postMessageSafe(ctx.db, requestId, 'system', message)
  const fresh = await getRequest(ctx.db, requestId).catch(() => null)
  if (fresh)
    await notify(ctx.config, { request: fresh, status: 'needs_attention', headline: message })
}

async function resetTrusted(ctx: JobContext): Promise<void> {
  await git(ctx.config.workDir, ['reset', '--hard'])
  await git(ctx.config.workDir, ['clean', '-ffdx', '-e', '/node_modules'])
}

async function discardWorkingTree(ctx: JobContext): Promise<void> {
  try {
    await resetTrusted(ctx)
  } catch (error) {
    log.warn('failed to reset checkout', { error })
  }
}

// ─── preview ────────────────────────────────────────────────────────────

async function waitForPreview(ctx: JobContext, sha: string): Promise<string> {
  // Resolves only for a deployment built from exactly `sha` (see selectPreviewDeployment).
  const deadline = Date.now() + ctx.config.previewTimeoutMs
  while (Date.now() < deadline) {
    checkpoint(ctx)
    try {
      const selection = selectPreviewDeployment(await ctx.gh.deploymentsForSha(sha), sha)
      if (selection.state === 'ready' && selection.sha === sha) return selection.url
      if (selection.state === 'failed') throw new Error(selection.detail)
    } catch (error) {
      if ((error as Error).message.startsWith('Vercel preview')) throw error
      log.warn('preview lookup failed; retrying', { error: String(error) })
    }
    await new Promise((resolve) => setTimeout(resolve, ctx.config.previewPollMs))
  }
  throw new Error(
    `No successful Vercel preview for ${sha.slice(0, 7)} within ${Math.round(ctx.config.previewTimeoutMs / 60_000)} minutes`
  )
}

// ─── CI ─────────────────────────────────────────────────────────────────

interface CiFailure {
  checkRunId: number
  htmlUrl: string | null
}

/**
 * Poll GitHub Checks for the exact pushed `sha` (see ci-status.ts). This
 * replaced running lint/typecheck/build a second time locally: CI already
 * runs `ci:validate` against this exact commit (.github/workflows/ci.yml),
 * so the worker now waits on that instead of duplicating it in its own
 * scratch checkout.
 */
async function waitForCi(ctx: JobContext, sha: string): Promise<CiFailure | null> {
  const deadline = Date.now() + ctx.config.ciTimeoutMs
  while (Date.now() < deadline) {
    checkpoint(ctx)
    try {
      const runs = await ctx.gh.checkRunsForSha(sha)
      const selection = selectRequiredCiConclusion(runs, ctx.config.ciCheckName)
      if (selection.state === 'success') return null
      if (selection.state === 'failure') {
        return { checkRunId: selection.checkRunId, htmlUrl: selection.htmlUrl }
      }
    } catch (error) {
      log.warn('CI status lookup failed; retrying', { error: String(error) })
    }
    await new Promise((resolve) => setTimeout(resolve, ctx.config.ciPollMs))
  }
  throw new Error(
    `CI check "${ctx.config.ciCheckName}" did not conclude for ${sha.slice(0, 7)} within ${Math.round(ctx.config.ciTimeoutMs / 60_000)} minutes`
  )
}

/** Best-effort job log for the failing check run, redacted and truncated for a repair prompt. */
async function ciFailureExcerpt(ctx: JobContext, failure: CiFailure): Promise<string> {
  try {
    const text = await ctx.gh.jobLog(failure.checkRunId)
    return redact(text).slice(-12_000)
  } catch (error) {
    return `(could not fetch the CI job log: ${String(error)}${failure.htmlUrl ? `; see ${failure.htmlUrl}` : ''})`
  }
}

// ─── pipeline ───────────────────────────────────────────────────────────

export async function processRequest(ctx: JobContext, claimed: ChangeRequest): Promise<void> {
  const started = Date.now()
  log.info('job started', {
    requestId: claimed.id,
    title: claimed.title,
    attempt: claimed.attempts,
  })
  try {
    await runPipeline(ctx, claimed)
    log.info('job finished', { requestId: claimed.id, durationMs: Date.now() - started })
  } catch (error) {
    if (error instanceof Stop) {
      log.info('job stopped', {
        requestId: claimed.id,
        reason: error.message,
        durationMs: Date.now() - started,
      })
      return
    }
    if (error instanceof ShutdownError || ctx.isShuttingDown()) {
      log.warn('job interrupted by shutdown', { requestId: claimed.id })
      const requeue = claimed.attempts < ctx.config.maxAttempts
      try {
        await updateRequest(
          ctx.db,
          claimed.id,
          requeue
            ? { status: 'queued', claimed_by: null, claimed_at: null, error: null }
            : { status: 'needs_attention', error: 'Worker restarted while processing this request' }
        )
        await postMessageSafe(
          ctx.db,
          claimed.id,
          'system',
          requeue
            ? 'The worker restarted while processing this request; it has been queued again.'
            : 'The worker restarted while processing this request and it has used all its attempts.'
        )
      } catch (e) {
        log.error('failed to release request on shutdown', { requestId: claimed.id, error: e })
      }
      return
    }
    log.error('job failed', { requestId: claimed.id, error })
    const message = humanError(error)
    try {
      await needsAttention(
        ctx,
        claimed.id,
        message,
        `The worker hit an error and stopped: ${message}`
      )
    } catch (e) {
      log.error('failed to record job failure', { requestId: claimed.id, error: e })
    }
  } finally {
    await discardWorkingTree(ctx)
    await removeAgentCheckout(agentCheckoutDir(ctx.config, shortId(claimed.id))).catch((error) =>
      log.warn('failed to remove agent checkout', { error: String(error) })
    )
  }
}

async function runPipeline(ctx: JobContext, claimed: ChangeRequest): Promise<void> {
  const { config, db } = ctx
  const request = claimed
  const messages = await getMessages(db, request.id)
  // Reuse existing branches, but never publish private titles in new names.
  const branch = request.branch_name || branchName(request.id, 'website-update')
  if (!config.dryRun) await ctx.gh.markDraftForBranch(branch)

  // 2. Prepare. Old verification screenshots belong to an older revision.
  const removed = await deleteVerificationFiles(db, request.id)
  if (removed) log.info('removed previous verification files', { requestId: request.id, removed })
  await postMessage(
    db,
    request.id,
    'system',
    'The worker picked up this request and is preparing a change.'
  )
  await ensureClone(config)
  const baseSha = await prepareBranch(config, branch)
  await ensureDependencies(config)

  // Agent sandbox: plain export of the base commit, no .git, no node_modules.
  const agentDir = agentCheckoutDir(config, shortId(request.id))
  await createAgentCheckout(config, agentDir, baseSha)
  const baseSnapshot = await snapshotTree(agentDir)
  const attachments = await placeAttachments(ctx, request, agentDir)
  const ws: Workspace = { agentDir, baseSnapshot, attachments }
  log.info('checkouts ready', { requestId: request.id, branch, baseSha, agentDir })
  checkpoint(ctx)

  // 3. Agent (sandbox only)
  const prompt = buildAgentPrompt({ request, messages, attachments })
  const first = await runClaude(config, {
    cwd: agentDir,
    prompt,
    tools: EDIT_TOOLS,
    label: 'edit',
  })
  const outcome = parseAgentResult(first.result)
  checkpoint(ctx)

  if (outcome.kind === 'clarification') {
    await postMessage(db, request.id, 'agent', outcome.question)
    await needsAttention(
      ctx,
      request.id,
      'Clarification needed',
      'The agent needs more information before making this change. Reply in the thread to send it back to the queue.'
    )
    throw new Stop('clarification requested')
  }
  let summary = outcome.text

  const rejectChange = async (error: GuardrailError, prefix: string, stop: string) => {
    await discardWorkingTree(ctx)
    await postMessageSafe(db, request.id, 'agent', summary)
    await needsAttention(ctx, request.id, error.message, `${prefix}: ${error.message}`)
    throw new Stop(stop)
  }

  // 4. Guardrails, then copy validated files into the trusted checkout
  let change: GuardedChange
  try {
    change = await syncValidatedChanges(ctx, ws)
  } catch (error) {
    if (!(error instanceof GuardrailError)) throw error
    return rejectChange(error, 'The change was not submitted', 'guardrail rejected')
  }

  // 5. Prettier only (a trusted, deterministic formatting pass — see checks.ts).
  await formatFiles(config, change.files)
  // Formatting may have changed the diff: final guardrail pass on exactly what gets committed.
  try {
    change = await stagedChange(ctx, attachments)
  } catch (error) {
    if (!(error instanceof GuardrailError)) throw error
    return rejectChange(error, 'The formatted change was not submitted', 'guardrail rejected')
  }
  checkpoint(ctx)

  // 6. Commit (trusted checkout) / PR. Commit messages are public.
  const commitMessage = redactPublic(
    `${prTitle(`Website update ${shortId(request.id)}`, ctx.secrets)}\n\nSubmitted via /admin/requests (request ${request.id}).`,
    ctx.secrets
  )
  let headSha = await commit(config, commitMessage)
  log.info('committed change', {
    requestId: request.id,
    headSha,
    files: change.files,
    changedLines: change.changedLines,
  })

  if (config.dryRun) {
    const patch = await git(config.workDir, ['show', '--stat', '--patch', '--no-color', 'HEAD'])
    process.stdout.write(
      `\n===== DRY RUN DIFF (${request.id}) =====\n${redact(patch)}\n===== END DIFF =====\n`
    )
    await postMessage(db, request.id, 'agent', summary)
    await needsAttention(
      ctx,
      request.id,
      'dry run',
      `Dry run: the change passed guardrails (${change.files.length} files, ${change.changedLines} lines) but was not pushed and no pull request was opened.`,
      { branch_name: branch }
    )
    throw new Stop('dry run')
  }

  await pushBranch(config, branch)
  const pr = await ctx.gh.openOrUpdatePull({
    branch,
    base: config.baseBranch,
    title: prTitle(`Website update ${shortId(request.id)}`, ctx.secrets),
    body: buildPrBody({
      request,
      siteUrl: config.siteUrl,
      agentSummary: summary,
      changedFiles: change.files,
      changedLines: change.changedLines,
      attachmentNames: change.keptAttachments.map((a) => path.posix.basename(a.repoPath)),
      secrets: ctx.secrets,
    }),
  })
  await updateRequest(db, request.id, {
    status: 'verifying',
    branch_name: branch,
    pr_number: pr.number,
    pr_url: pr.html_url,
    preview_url: null,
    verification: null,
    error: null,
  })
  await postMessage(db, request.id, 'agent', summary)
  await postMessage(
    db,
    request.id,
    'system',
    `${pr.created ? 'Opened pull request' : 'Updated pull request'} #${pr.number}: ${pr.html_url}\n${pr.created ? 'It opens as a draft and is' : 'It is'} marked ready for review automatically once CI checks and the Vercel preview verification both pass.`
  )
  log.info('pull request ready', { requestId: request.id, pr: pr.number, created: pr.created })

  // 7. CI on the exact pushed commit (+ one repair round if it fails). The PR
  // is already open (as a draft, see openOrUpdatePull) at this point: unlike
  // the old local-checks flow, a CI failure here does not mean "no PR was
  // opened" — it means the open (draft) PR is left with failing checks for a
  // human to look at (reported to the parent task as a deliberate, PR-visible
  // behavior change from the previous never-opens-a-PR-on-failure model; the
  // draft state is what keeps a not-yet-verified PR from looking mergeable).
  let ciFailure: CiFailure | null
  try {
    ciFailure = await waitForCi(ctx, headSha)
  } catch (error) {
    if (error instanceof ShutdownError) throw error
    await needsAttention(
      ctx,
      request.id,
      humanError(error),
      `Pull request #${pr.number} is open but its CI checks could not be verified: ${humanError(error)}`
    )
    throw new Stop('CI unavailable')
  }
  if (ciFailure) {
    checkpoint(ctx)
    log.info('CI failed; running repair round', {
      requestId: request.id,
      checkRunId: ciFailure.checkRunId,
    })
    const excerpt = await ciFailureExcerpt(ctx, ciFailure)
    const repair = await runClaude(config, {
      cwd: agentDir,
      prompt: buildRepairPrompt(prompt, change.patch, excerpt),
      tools: EDIT_TOOLS,
      label: 'repair',
    })
    const repairOutcome = parseAgentResult(repair.result)
    if (repairOutcome.kind === 'summary') summary = repairOutcome.text

    const rejectRepair = async (error: GuardrailError): Promise<never> => {
      await discardWorkingTree(ctx)
      await postMessageSafe(db, request.id, 'agent', summary)
      await needsAttention(
        ctx,
        request.id,
        error.message,
        `Pull request #${pr.number} is open but its CI checks failed, and the repair attempt did not pass guardrails so nothing more was pushed: ${error.message}`
      )
      throw new Stop('guardrail rejected after CI repair')
    }

    try {
      change = await syncValidatedChanges(ctx, ws)
    } catch (error) {
      if (!(error instanceof GuardrailError)) throw error
      await rejectRepair(error)
    }
    await formatFiles(config, change.files)
    try {
      change = await stagedChange(ctx, attachments)
    } catch (error) {
      if (!(error instanceof GuardrailError)) throw error
      await rejectRepair(error)
    }
    checkpoint(ctx)

    headSha = await commit(config, commitMessage)
    log.info('committed CI repair', { requestId: request.id, headSha })
    await pushBranch(config, branch)
    await postMessage(db, request.id, 'agent', summary)
    await postMessage(
      db,
      request.id,
      'system',
      `Pushed a repair for the failing CI checks (commit ${headSha.slice(0, 7)}); waiting on CI again.`
    )

    let secondFailure: CiFailure | null
    try {
      secondFailure = await waitForCi(ctx, headSha)
    } catch (error) {
      if (error instanceof ShutdownError) throw error
      await needsAttention(
        ctx,
        request.id,
        humanError(error),
        `Pull request #${pr.number} is open but its CI checks could not be verified after the repair: ${humanError(error)}`
      )
      throw new Stop('CI unavailable after repair')
    }
    if (secondFailure) {
      const secondExcerpt = (await ciFailureExcerpt(ctx, secondFailure)).slice(-1800)
      await needsAttention(
        ctx,
        request.id,
        'CI checks failed after one repair attempt',
        `Pull request #${pr.number} is open but its CI checks failed even after one repair attempt, so it was left open for a human to fix.\n\n${secondExcerpt}`
      )
      throw new Stop('CI failed')
    }
  }
  log.info('CI passed', { requestId: request.id, headSha })

  // 8. Preview for exactly the pushed (possibly repaired) commit
  let previewUrl: string
  try {
    previewUrl = await waitForPreview(ctx, headSha)
  } catch (error) {
    if (error instanceof ShutdownError) throw error
    await needsAttention(
      ctx,
      request.id,
      humanError(error),
      `The pull request is open but the preview could not be verified: ${humanError(error)}`
    )
    throw new Stop('preview unavailable')
  }
  await updateRequest(db, request.id, { preview_url: previewUrl })
  log.info('preview ready', { requestId: request.id, previewUrl, sha: headSha })

  // 9. Verify
  const latestMessages = await getMessages(db, request.id)
  const verification: VerificationResult = await verifyPreview({
    config,
    db,
    request,
    messages: latestMessages,
    agentSummary: summary,
    previewUrl,
    commitSha: headSha,
  })
  if (verification.commit_sha !== headSha) {
    throw new Error('Verification does not belong to the pushed commit')
  }
  const passed = verification.verdict === 'pass' && hardChecksPass(verification.checks)
  // Persist private evidence first, but never report readiness before GitHub confirms it.
  await updateRequest(db, request.id, { verification })
  if (passed) await ctx.gh.markReadyForReview(pr.number)
  const finalStatus = passed ? 'ready_for_review' : 'needs_attention'
  await updateRequest(db, request.id, {
    verification,
    status: finalStatus,
    error: passed
      ? null
      : verification.verdict === 'pass'
        ? `Automated preview checks failed: ${verification.checks
            .filter((c) => !c.ok && !c.name.includes('advisory'))
            .map((c) => c.name)
            .join(', ')}`
        : `Verification verdict: ${verification.verdict}`,
  })
  try {
    await ctx.gh.comment(
      pr.number,
      buildVerdictComment(
        { ...verification, verdict: passed ? 'pass' : 'fail' },
        previewUrl,
        `${config.siteUrl}/admin/requests/${request.id}`
      )
    )
  } catch (error) {
    log.warn('failed to comment verdict on PR', { error: String(error) })
  }
  const headline = passed
    ? `Preview verified (${verification.verdict}): ${verification.summary}`
    : `Preview verification needs a human look (${verification.verdict}${hardChecksPass(verification.checks) ? '' : ', automated checks failed'}): ${verification.summary}`
  await postMessage(db, request.id, 'system', `${headline}\nPreview: ${previewUrl}`)
  const fresh = await getRequest(db, request.id)
  await notify(config, { request: fresh, status: finalStatus, headline })
}
