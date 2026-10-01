import type { Config } from './config'
import { listMergedAwaitingLive, postMessageSafe, updateIfStatus, type Db } from './db'
import type { GitHub } from './github'
import { log } from './log'
import type { DeploymentWithStatuses } from './preview'
import type { ChangeRequest } from './types'

/** A merge without a successful production deployment after this long is reported. */
export const LIVE_DEPLOY_TIMEOUT_MS = 30 * 60_000

export type ProductionState =
  | { state: 'ready'; sha: string }
  | { state: 'failed'; detail: string }
  | { state: 'pending' }

const PRODUCTION = /^production$/i

function latestStatus(deployment: DeploymentWithStatuses) {
  return [...deployment.statuses].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
  )[0]
}

/**
 * The newest production deployment's outcome, or null if there is none.
 * `inactive` means it went live and was later replaced, so it counts as ready.
 */
export function selectProductionDeployment(
  deployments: DeploymentWithStatuses[]
): ProductionState | null {
  const newest = deployments
    .filter((d) => PRODUCTION.test(d.environment))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0]
  if (!newest) return null
  const status = latestStatus(newest)
  if (!status) return { state: 'pending' }
  if (status.state === 'success' || status.state === 'inactive') {
    return { state: 'ready', sha: newest.sha }
  }
  if (status.state === 'failure' || status.state === 'error') {
    return { state: 'failed', detail: `the production deployment reported "${status.state}"` }
  }
  return { state: 'pending' }
}

/**
 * Production state for a merge commit. Vercel can skip or cancel the build of
 * a commit that a newer push supersedes, so with no deployment of its own the
 * commit counts as deployed once a newer successful production deployment
 * contains it.
 */
async function productionStateFor(gh: GitHub, sha: string): Promise<ProductionState> {
  const own = selectProductionDeployment(await gh.deploymentsForSha(sha))
  if (own && own.state !== 'failed') return own
  const latest = (await gh.latestProductionDeployments())
    .filter((d) => latestStatus(d)?.state === 'success')
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0]
  if (latest && latest.sha !== sha && (await gh.commitContains(latest.sha, sha))) {
    return { state: 'ready', sha: latest.sha }
  }
  return own ?? { state: 'pending' }
}

export interface LiveCheckDeps {
  fetchPage?: (url: string) => Promise<number>
  now?: () => Date
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

type RowOutcome = 'live' | 'failed' | 'pending'

async function reportFailure(db: Db, row: ChangeRequest, now: Date, message: string) {
  const recorded = await updateIfStatus(db, row.id, 'merged', {
    live_check_failed_at: now.toISOString(),
    error: message,
  })
  if (!recorded) return
  log.warn('live check failed', { requestId: row.id, message })
  await postMessageSafe(db, row.id, 'system', `Not confirmed live: ${message}`)
}

async function checkRow(
  db: Db,
  gh: GitHub,
  config: Config,
  row: ChangeRequest,
  deps: Required<LiveCheckDeps>
): Promise<RowOutcome> {
  const sha = row.merge_commit_sha as string
  const now = deps.now()
  const production = await productionStateFor(gh, sha)
  if (production.state === 'failed') {
    await reportFailure(
      db,
      row,
      now,
      `${production.detail} for merge commit ${sha.slice(0, 7)}. Check Vercel; the live site still shows the previous version.`
    )
    return 'failed'
  }
  if (production.state === 'pending') {
    const mergedAt = row.merged_at ? Date.parse(row.merged_at) : now.getTime()
    if (now.getTime() - mergedAt < LIVE_DEPLOY_TIMEOUT_MS) return 'pending'
    await reportFailure(
      db,
      row,
      now,
      `no successful Vercel production deployment of merge commit ${sha.slice(0, 7)} appeared within ${LIVE_DEPLOY_TIMEOUT_MS / 60_000} minutes. Check Vercel.`
    )
    return 'failed'
  }

  const url = new URL(row.page_path, config.siteUrl).toString()
  let status: number
  try {
    status = await deps.fetchPage(url)
  } catch (error) {
    log.warn('live page check failed; will retry', { requestId: row.id, error: String(error) })
    return 'pending'
  }
  if (status < 200 || status >= 300) {
    await reportFailure(
      db,
      row,
      now,
      `the production deployment finished, but ${url} returned HTTP ${status}.`
    )
    return 'failed'
  }
  if (
    await updateIfStatus(db, row.id, 'merged', {
      status: 'live',
      live_at: now.toISOString(),
      error: null,
    })
  ) {
    log.info('change is live', { requestId: row.id, sha, deployedSha: production.sha })
    await postMessageSafe(db, row.id, 'system', `Live on site ↗ ${url}`)
  }
  return 'live'
}

/**
 * Confirm merged requests are live (#362): wait for the Vercel production
 * deployment of the merge commit, check the request's page on the live
 * domain, then mark the request `live` and post "Live on site ↗". A failed
 * deployment, a missing one after LIVE_DEPLOY_TIMEOUT_MS, or a non-2xx page is
 * reported once in the thread and on the request. With `waitMs`, pending
 * deployments are polled until they settle or the wait ends (used by one-shot
 * runs, which have no later sweep).
 */
export async function confirmLiveDeployments(
  db: Db,
  gh: GitHub,
  config: Config,
  options: LiveCheckDeps & { waitMs?: number; pollMs?: number; dryRun?: boolean } = {}
): Promise<void> {
  if (options.dryRun) return
  const deps: Required<LiveCheckDeps> = {
    fetchPage: options.fetchPage ?? defaultFetchPage,
    now: options.now ?? (() => new Date()),
  }
  const deadline = deps.now().getTime() + (options.waitMs ?? 0)
  let rows = await listMergedAwaitingLive(db)
  while (rows.length > 0) {
    const pending: ChangeRequest[] = []
    for (const row of rows) {
      try {
        if ((await checkRow(db, gh, config, row, deps)) === 'pending') pending.push(row)
      } catch (error) {
        log.warn('live check error; will retry', { requestId: row.id, error: String(error) })
      }
    }
    if (pending.length === 0 || deps.now().getTime() >= deadline) return
    await new Promise((resolve) => setTimeout(resolve, options.pollMs ?? 30_000))
    rows = pending
  }
}
