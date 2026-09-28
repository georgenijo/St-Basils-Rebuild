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
