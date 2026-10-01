import type { Config } from './config'
import { listByStatus, postMessageSafe, updateIfStatus, type Db } from './db'
import { log } from './log'
import { notify } from './notify'
import type { ChangeRequest } from './types'

export type StaleAction = 'requeue' | 'needs_attention' | 'skip'

export interface StaleOptions {
  workerId: string
  now: Date
  staleMinutes: number
  maxAttempts: number
}

/**
 * Decide what to do with a request this worker claimed earlier but never
 * finished (crash, OOM, redeploy). Only requests claimed by this worker id,
 * still in a working state, and older than the stale window are touched.
 */
export function staleClaimAction(
  request: Pick<ChangeRequest, 'status' | 'claimed_by' | 'claimed_at' | 'attempts'>,
  options: StaleOptions
): StaleAction {
  if (request.status !== 'in_progress' && request.status !== 'verifying') return 'skip'
  if (request.claimed_by !== options.workerId) return 'skip'
  if (!request.claimed_at) return 'skip'
  const claimedAt = Date.parse(request.claimed_at)
  if (!Number.isFinite(claimedAt)) return 'skip'
  const ageMinutes = (options.now.getTime() - claimedAt) / 60_000
  if (ageMinutes < options.staleMinutes) return 'skip'
  return request.attempts < options.maxAttempts ? 'requeue' : 'needs_attention'
}

/**
 * Requeue or give up on this worker's stale claims. Giving up emails the
 * notification recipients like any other needs_attention outcome.
 */
export async function recoverStaleClaims(db: Db, config: Config): Promise<void> {
  const rows = await listByStatus(db, ['in_progress', 'verifying'])
  for (const row of rows) {
    const action = staleClaimAction(row, {
      workerId: config.workerId,
      now: new Date(),
      staleMinutes: config.staleClaimMinutes,
      maxAttempts: config.maxAttempts,
    })
    if (action === 'skip') continue
    const error = `Worker stopped while processing (attempt ${row.attempts} of ${config.maxAttempts})`
    const changed =
      action === 'requeue'
        ? await updateIfStatus(db, row.id, row.status, {
            status: 'queued',
            claimed_by: null,
            claimed_at: null,
          })
        : await updateIfStatus(db, row.id, row.status, { status: 'needs_attention', error })
    if (!changed) continue
    log.warn('recovered stale claim', { requestId: row.id, action, attempts: row.attempts })
    const message =
      action === 'requeue'
        ? 'The worker stopped before finishing this request; it has been queued again.'
        : `The worker stopped before finishing this request and it has used all ${config.maxAttempts} attempts.`
    await postMessageSafe(db, row.id, 'system', message)
    if (action === 'needs_attention') {
      await notify(config, {
        request: row,
        status: 'needs_attention',
        headline: message,
      })
    }
  }
}
