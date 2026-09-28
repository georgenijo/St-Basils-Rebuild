import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

import { formatFiles, runChecks, type CheckResult } from './checks'
import { EDIT_TOOLS, runClaude } from './claude'
import type { Config } from './config'
import {
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
import { countChangedLines, evaluateGuardrails, unreferencedAttachments } from './guardrails'
import { log, redact } from './log'
import { attachmentDisplayName, branchName, safeFilename, shortId } from './naming'
import { notify } from './notify'
import { buildPrBody, buildVerdictComment } from './prbody'
import { selectPreviewDeployment } from './preview'
import { buildAgentPrompt, buildRepairPrompt, parseAgentResult } from './prompt'
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

const TEXT_EXT = /\.(tsx?|jsx?|mjs|cjs|css|json|md|mdx|html|svg|txt|ya?ml)$/i

// ─── attachments ────────────────────────────────────────────────────────

async function placeAttachments(
  ctx: JobContext,
  request: ChangeRequest
): Promise<PlacedAttachment[]> {
  const rows = await getFiles(ctx.db, request.id, 'attachment')
  if (rows.length === 0) return []
  const relDir = path.posix.join('public', 'images', 'requests', shortId(request.id))
  const absDir = path.join(ctx.config.workDir, relDir)
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
    await fs.writeFile(path.join(absDir, name), data)
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

async function applyGuardrails(
  ctx: JobContext,
  attachments: PlacedAttachment[]
): Promise<GuardedChange> {
  const dir = ctx.config.workDir
  let files = await changedFiles(dir)

  const contents = new Map<string, string>()
  for (const file of files) {
    const abs = path.join(dir, file.path)
    if (TEXT_EXT.test(file.path) && existsSync(abs))
      contents.set(file.path, await fs.readFile(abs, 'utf8'))
  }
  const unused = unreferencedAttachments(
    attachments.filter((a) => existsSync(path.join(dir, a.repoPath))),
    contents
  )
  for (const attachment of unused) await fs.rm(path.join(dir, attachment.repoPath), { force: true })
  if (unused.length) {
    log.info('removed unreferenced attachments', { files: unused.map((a) => a.repoPath) })
    files = await changedFiles(dir)
  }

  const staged = await stageAll(dir)
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
    keptAttachments: attachments.filter((a) => existsSync(path.join(dir, a.repoPath))),
  }
}

class GuardrailError extends Error {}

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

async function discardWorkingTree(ctx: JobContext): Promise<void> {
  try {
    await git(ctx.config.workDir, ['reset', '--hard'])
    await git(ctx.config.workDir, ['clean', '-ffdx', '-e', '/node_modules'])
  } catch (error) {
    log.warn('failed to reset checkout', { error })
  }
}

// ─── preview ────────────────────────────────────────────────────────────

async function waitForPreview(ctx: JobContext, sha: string): Promise<string> {
  const deadline = Date.now() + ctx.config.previewTimeoutMs
  while (Date.now() < deadline) {
    checkpoint(ctx)
    try {
      const selection = selectPreviewDeployment(await ctx.gh.deploymentsForSha(sha), sha)
      if (selection.state === 'ready') return selection.url
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
  }
}

async function runPipeline(ctx: JobContext, claimed: ChangeRequest): Promise<void> {
  const { config, db } = ctx
  const request = claimed
  const messages = await getMessages(db, request.id)
  const branch = branchName(request.id, request.title)

  // 2. Prepare
  await postMessage(
    db,
    request.id,
    'system',
    'The worker picked up this request and is preparing a change.'
  )
  await ensureClone(config)
  const baseSha = await prepareBranch(config, branch)
  await ensureDependencies(config)
  const attachments = await placeAttachments(ctx, request)
  log.info('checkout ready', { requestId: request.id, branch, baseSha })
  checkpoint(ctx)

  // 3. Agent
  const prompt = buildAgentPrompt({ request, messages, attachments })
  const first = await runClaude(config, {
    cwd: config.workDir,
    prompt,
    tools: EDIT_TOOLS,
    label: 'edit',
  })
  let outcome = parseAgentResult(first.result)
  checkpoint(ctx)

  if (outcome.kind === 'clarification') {
    await discardWorkingTree(ctx)
    await postMessage(db, request.id, 'agent', outcome.question)
    await needsAttention(
      ctx,
      request.id,
      'Clarification needed',
      'The agent needs more information before making this change. Reply in the thread to send it back to the queue.'
    )
    throw new Stop('clarification requested')
  }

  // 4. Guardrails
  let change: GuardedChange
  try {
    change = await applyGuardrails(ctx, attachments)
  } catch (error) {
    if (!(error instanceof GuardrailError)) throw error
    await discardWorkingTree(ctx)
    await postMessageSafe(db, request.id, 'agent', outcome.text)
    await needsAttention(
      ctx,
      request.id,
      error.message,
      `The change was not submitted: ${error.message}`
    )
    throw new Stop('guardrail rejected')
  }

  // 5. Checks (+ one repair round)
  await formatFiles(config, change.files)
  let checks: CheckResult = await runChecks(config)
  let repaired = false
  if (!checks.ok) {
    checkpoint(ctx)
    log.info('checks failed; running repair round', { requestId: request.id })
    const repair = await runClaude(config, {
      cwd: config.workDir,
      prompt: buildRepairPrompt(prompt, change.patch, checks.output),
      tools: EDIT_TOOLS,
      label: 'repair',
    })
    repaired = true
    const repairOutcome = parseAgentResult(repair.result)
    if (repairOutcome.kind === 'summary') outcome = repairOutcome
    try {
      change = await applyGuardrails(ctx, attachments)
    } catch (error) {
      if (!(error instanceof GuardrailError)) throw error
      await discardWorkingTree(ctx)
      await needsAttention(
        ctx,
        request.id,
        error.message,
        `The repaired change was not submitted: ${error.message}`
      )
      throw new Stop('guardrail rejected after repair')
    }
    await formatFiles(config, change.files)
    checks = await runChecks(config)
    if (!checks.ok) {
      const excerpt = checks.output.slice(-1800)
      await discardWorkingTree(ctx)
      await postMessageSafe(db, request.id, 'agent', outcome.text)
      await needsAttention(
        ctx,
        request.id,
        'Lint/typecheck failed after one repair attempt',
        `The change did not pass the website checks, even after one repair attempt, so no pull request was opened.\n\n${excerpt}`
      )
      throw new Stop('checks failed')
    }
  }
  // Formatting/repair may have changed the diff: final guardrail pass on exactly what gets committed.
  change = await applyGuardrails(ctx, attachments)
  checkpoint(ctx)

  // 6. Commit / PR
  const commitMessage = `Change request: ${request.title.replace(/[\r\n]+/g, ' ')}\n\nSubmitted via /admin/requests (request ${request.id}).`
  const headSha = await commit(config, commitMessage)
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
    await postMessage(db, request.id, 'agent', outcome.text)
    await needsAttention(
      ctx,
      request.id,
      'dry run',
      `Dry run: the change passed guardrails and checks (${change.files.length} files, ${change.changedLines} lines) but was not pushed and no pull request was opened.`,
      { branch_name: branch }
    )
    throw new Stop('dry run')
  }

  await pushBranch(config, branch)
  const pr = await ctx.gh.openOrUpdatePull({
    branch,
    base: config.baseBranch,
    title: `Change request: ${request.title.replace(/[\r\n]+/g, ' ')}`,
    body: buildPrBody({
      request,
      agentSummary: outcome.text,
      changedFiles: change.files,
      changedLines: change.changedLines,
      attachmentNames: change.keptAttachments.map((a) => path.posix.basename(a.repoPath)),
      checksRan: checks.ran,
      repaired,
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
  await postMessage(db, request.id, 'agent', outcome.text)
  await postMessage(
    db,
    request.id,
    'system',
    `${pr.created ? 'Opened' : 'Updated'} pull request #${pr.number}: ${pr.html_url}\nWaiting for the Vercel preview to verify it.`
  )
  log.info('pull request ready', { requestId: request.id, pr: pr.number, created: pr.created })

  // 7. Preview
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
  log.info('preview ready', { requestId: request.id, previewUrl })

  // 8. Verify
  const latestMessages = await getMessages(db, request.id)
  const verification: VerificationResult = await verifyPreview({
    config,
    db,
    request,
    messages: latestMessages,
    agentSummary: outcome.text,
    previewUrl,
  })
  const passed = verification.verdict === 'pass' && hardChecksPass(verification.checks)
  const finalStatus = passed ? 'ready_for_review' : 'needs_attention'
  await updateRequest(db, request.id, {
    verification,
    status: finalStatus,
    error: passed
      ? null
      : verification.verdict === 'pass'
        ? 'Automated preview checks failed'
        : `Verification verdict: ${verification.verdict}`,
  })
  try {
    await ctx.gh.comment(pr.number, buildVerdictComment(verification, previewUrl))
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
