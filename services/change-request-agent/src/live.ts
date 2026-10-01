import type { Config } from './config'
import { listMergedAwaitingLive, recordLiveCheck, updateIfStatus, type Db } from './db'
import type { GitHub } from './github'
import { log } from './log'
import type { DeploymentWithStatuses } from './preview'
import type { ChangeRequest } from './types'

/**
 * Every merged request gets an outcome within this long of its merge: live,
 * or a visible failure (failed or missing deployment, a page that does not
 * load, or GitHub lookups that keep failing).
 */
export const LIVE_DEPLOY_TIMEOUT_MS = 30 * 60_000

const PRODUCTION = /^production$/i

function latestStatus(deployment: DeploymentWithStatuses) {
  return [...deployment.statuses].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
  )[0]
}

function newestFirst(deployments: DeploymentWithStatuses[]) {
  return deployments
    .filter((d) => PRODUCTION.test(d.environment))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
}

/**
 * What production is serving now: the newest production deployment whose
 * latest status is `success`. (GitHub marks a replaced or rolled-back
 * deployment `inactive`, so an inactive deployment is never current.)
 */
export function currentProduction(deployments: DeploymentWithStatuses[]): string | null {
  return newestFirst(deployments).find((d) => latestStatus(d)?.state === 'success')?.sha ?? null
}

/** Whether the merge commit's own newest production deployment failed. */
export function ownDeploymentFailed(deployments: DeploymentWithStatuses[]): string | null {
  const newest = newestFirst(deployments)[0]
  const state = newest ? latestStatus(newest)?.state : undefined
  return state === 'failure' || state === 'error' ? state : null
}

export type ProductionState =
  | { state: 'ready'; sha: string }
  | { state: 'failed'; detail: string }
  | { state: 'pending' }

/**
 * Live means production currently serves the merge commit or a descendant of
 * it (Vercel may skip or never finish the merge's own build when a newer push
 * supersedes it). Otherwise the merge's own failed deployment is a failure,
 * and anything else is still pending.
 */
async function productionStateFor(gh: GitHub, sha: string): Promise<ProductionState> {
  const current = currentProduction(await gh.latestProductionDeployments())
  if (current && (current === sha || (await gh.commitContains(current, sha)))) {
    return { state: 'ready', sha: current }
  }
  const failed = ownDeploymentFailed(await gh.deploymentsForSha(sha))
  if (failed) return { state: 'failed', detail: `the production deployment reported "${failed}"` }
  return { state: 'pending' }
}

export interface LiveCheckOptions {
  fetchPage?: (url: string) => Promise<number>
  now?: () => Date
  /** One-shot runs: keep polling pending requests for up to this long. */
  waitMs?: number
  pollMs?: number
  /** Interruptible sleep (the worker's, so shutdown wakes it). */
  sleep?: (ms: number) => Promise<void>
  isShuttingDown?: () => boolean
  dryRun?: boolean
}

async function defaultFetchPage(url: string): Promise<number> {
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: { 'User-Agent': 'st-basils-change-request-agent (live check)' },
    signal: AbortSignal.timeout(20_000),
  })
  await response.body?.cancel()
  return response.status
}

type RowOutcome = 'done' | 'pending'

/** Fill in a merge commit (and merge time) missing from the request, from its PR. */
async function ensureMergeCommit(
  db: Db,
  gh: GitHub,
  row: ChangeRequest
): Promise<ChangeRequest | null> {
  if (row.merge_commit_sha && row.merged_at) return row
  if (!row.pr_number) return row.merge_commit_sha ? row : null
  const pr = await gh.pullState(row.pr_number)
  const mergeCommitSha = row.merge_commit_sha ?? pr.mergeCommitSha
  if (!mergeCommitSha) return null
  const mergedAt = row.merged_at ?? pr.mergedAt ?? row.updated_at
  await updateIfStatus(db, row.id, 'merged', {
    merge_commit_sha: mergeCommitSha,
    merged_at: mergedAt,
  })
  return { ...row, merge_commit_sha: mergeCommitSha, merged_at: mergedAt }
}

function pastDeadline(row: ChangeRequest, now: Date): boolean {
  const since = Date.parse(row.merged_at ?? row.updated_at)
  return now.getTime() - since >= LIVE_DEPLOY_TIMEOUT_MS
}

async function fail(db: Db, row: ChangeRequest, problem: string): Promise<RowOutcome> {
  if (await recordLiveCheck(db, row.id, 'failed', `Not confirmed live: ${problem}`, problem)) {
    log.warn('live check failed', { requestId: row.id, problem })
  }
  return 'done'
}

async function checkRow(
  db: Db,
  gh: GitHub,
  config: Config,
  original: ChangeRequest,
  fetchPage: (url: string) => Promise<number>,
  now: Date
): Promise<RowOutcome> {
  const row = await ensureMergeCommit(db, gh, original)
  if (!row) {
    return fail(
      db,
      original,
      'the merge commit could not be found on GitHub, so the live site could not be checked.'
    )
  }
  const sha = row.merge_commit_sha as string
  const production = await productionStateFor(gh, sha)
  if (production.state === 'failed') {
    return fail(
      db,
      row,
      `${production.detail} for merge commit ${sha.slice(0, 7)}. Check Vercel; the live site still shows the previous version.`
    )
  }
  if (production.state === 'pending') {
    if (!pastDeadline(row, now)) return 'pending'
    return fail(
      db,
      row,
      `no Vercel production deployment containing merge commit ${sha.slice(0, 7)} went live within ${LIVE_DEPLOY_TIMEOUT_MS / 60_000} minutes. Check Vercel.`
    )
  }

  const url = new URL(row.page_path, config.siteUrl).toString()
  let status: number
  try {
    status = await fetchPage(url)
  } catch {
    if (!pastDeadline(row, now)) return 'pending'
    return fail(db, row, `the production deployment finished, but ${url} could not be loaded.`)
  }
  if (status < 200 || status >= 300) {
    if (!pastDeadline(row, now)) return 'pending'
    return fail(db, row, `the production deployment finished, but ${url} returned HTTP ${status}.`)
  }
  if (await recordLiveCheck(db, row.id, 'live', `Live on site ↗ ${url}`)) {
    log.info('change is live', { requestId: row.id, sha, deployedSha: production.sha })
  }
  return 'done'
}

/**
 * Confirm merged requests are live (#362): once production serves the merge
 * commit (or a descendant) and the request's page loads on the live domain,
 * the request becomes `live` with "Live on site ↗" in the thread. Anything
 * still unresolved LIVE_DEPLOY_TIMEOUT_MS after the merge (failed or missing
 * deployment, page errors, repeated lookup errors) is reported once instead.
 * Outcomes and their thread entries are written together, first one wins.
 * With `waitMs`, pending requests (including ones whose lookup errored) are
 * polled until they settle, the wait ends, or the worker shuts down.
 */
export async function confirmLiveDeployments(
  db: Db,
  gh: GitHub,
  config: Config,
  options: LiveCheckOptions = {}
): Promise<void> {
  if (options.dryRun) return
  const now = options.now ?? (() => new Date())
  const fetchPage = options.fetchPage ?? defaultFetchPage
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const stopping = options.isShuttingDown ?? (() => false)
  const deadline = now().getTime() + (options.waitMs ?? 0)

  let rows = await listMergedAwaitingLive(db)
  while (rows.length > 0 && !stopping()) {
    const pending: ChangeRequest[] = []
    for (const row of rows) {
      if (stopping()) return
      try {
        if ((await checkRow(db, gh, config, row, fetchPage, now())) === 'pending') pending.push(row)
      } catch (error) {
        log.warn('live check error; will retry', { requestId: row.id, error: String(error) })
        if (pastDeadline(row, now())) {
          await fail(
            db,
            row,
            `the live check kept failing (${String(error).slice(0, 200)}). Check Vercel and GitHub.`
          ).catch((e) => log.warn('live check failure not recorded', { error: String(e) }))
        } else {
          pending.push(row)
        }
      }
    }
    if (pending.length === 0 || now().getTime() >= deadline || stopping()) return
    await sleep(options.pollMs ?? 30_000)
    rows = pending
  }
}
