import { describe, expect, it } from 'vitest'

import { staleClaimAction } from './stale'

const now = new Date('2026-09-28T12:00:00Z')
const options = { workerId: 'w1', now, staleMinutes: 90, maxAttempts: 3 }
const old = '2026-09-28T09:00:00Z'
const recent = '2026-09-28T11:30:00Z'

describe('staleClaimAction', () => {
  it('requeues old claims by this worker with attempts left', () => {
    expect(
      staleClaimAction(
        { status: 'in_progress', claimed_by: 'w1', claimed_at: old, attempts: 1 },
        options
      )
    ).toBe('requeue')
    expect(
      staleClaimAction(
        { status: 'verifying', claimed_by: 'w1', claimed_at: old, attempts: 2 },
        options
      )
    ).toBe('requeue')
  })

  it('gives up after max attempts', () => {
    expect(
      staleClaimAction(
        { status: 'in_progress', claimed_by: 'w1', claimed_at: old, attempts: 3 },
        options
      )
    ).toBe('needs_attention')
  })

  it('skips recent claims, other workers, other statuses, and missing timestamps', () => {
    expect(
      staleClaimAction(
        { status: 'in_progress', claimed_by: 'w1', claimed_at: recent, attempts: 1 },
        options
      )
    ).toBe('skip')
    expect(
      staleClaimAction(
        { status: 'in_progress', claimed_by: 'w2', claimed_at: old, attempts: 1 },
        options
      )
    ).toBe('skip')
    expect(
      staleClaimAction(
        { status: 'ready_for_review', claimed_by: 'w1', claimed_at: old, attempts: 1 },
        options
      )
    ).toBe('skip')
    expect(
      staleClaimAction(
        { status: 'queued', claimed_by: null, claimed_at: null, attempts: 0 },
        options
      )
    ).toBe('skip')
    expect(
      staleClaimAction(
        { status: 'in_progress', claimed_by: 'w1', claimed_at: null, attempts: 1 },
        options
      )
    ).toBe('skip')
  })

  it('treats exactly the window boundary as stale', () => {
    expect(
      staleClaimAction(
        {
          status: 'in_progress',
          claimed_by: 'w1',
          claimed_at: '2026-09-28T10:30:00Z',
          attempts: 1,
        },
        options
      )
    ).toBe('requeue')
  })
})
