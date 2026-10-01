import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Config } from './config'
import { listByStatus, postMessageSafe, updateIfStatus, type Db } from './db'
import { notify } from './notify'
import { recoverStaleClaims, staleClaimAction } from './stale'
import type { ChangeRequest } from './types'

vi.mock('./db', () => ({
  listByStatus: vi.fn(),
  postMessageSafe: vi.fn(),
  updateIfStatus: vi.fn(),
}))
vi.mock('./notify', () => ({ notify: vi.fn() }))

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

describe('recoverStaleClaims', () => {
  const db = {} as Db
  const config = { workerId: 'w1', staleClaimMinutes: 90, maxAttempts: 3 } as Config

  function row(overrides: Partial<ChangeRequest>): ChangeRequest {
    return {
      id: 'req-1',
      title: 'Replace flyer',
      status: 'in_progress',
      claimed_by: 'w1',
      claimed_at: '2000-01-01T00:00:00Z',
      attempts: 1,
      pr_url: null,
      preview_url: null,
      verification: null,
      error: null,
      ...overrides,
    } as ChangeRequest
  }

  beforeEach(() => {
    vi.mocked(listByStatus).mockReset()
    vi.mocked(postMessageSafe).mockReset().mockResolvedValue(undefined)
    vi.mocked(updateIfStatus).mockReset().mockResolvedValue(true)
    vi.mocked(notify).mockReset().mockResolvedValue(undefined)
  })

  it('requeues a stale claim with attempts left without emailing', async () => {
    vi.mocked(listByStatus).mockResolvedValue([row({ attempts: 1 })])
    await recoverStaleClaims(db, config)
    expect(updateIfStatus).toHaveBeenCalledWith(db, 'req-1', 'in_progress', {
      status: 'queued',
      claimed_by: null,
      claimed_at: null,
    })
    expect(postMessageSafe).toHaveBeenCalledWith(
      db,
      'req-1',
      'system',
      expect.stringContaining('queued again')
    )
    expect(notify).not.toHaveBeenCalled()
  })

  it('marks an exhausted stale claim needs_attention and emails about it', async () => {
    vi.mocked(listByStatus).mockResolvedValue([row({ status: 'verifying', attempts: 3 })])
    await recoverStaleClaims(db, config)
    const error = 'Worker stopped while processing (attempt 3 of 3)'
    expect(updateIfStatus).toHaveBeenCalledWith(db, 'req-1', 'verifying', {
      status: 'needs_attention',
      error,
    })
    expect(notify).toHaveBeenCalledTimes(1)
    expect(vi.mocked(notify).mock.calls[0]).toEqual([
      config,
      {
        request: expect.objectContaining({ id: 'req-1', status: 'needs_attention', error }),
        status: 'needs_attention',
        headline: expect.stringContaining('used all 3 attempts'),
      },
    ])
  })

  it('does nothing when the request changed underneath it', async () => {
    vi.mocked(listByStatus).mockResolvedValue([row({ attempts: 3 })])
    vi.mocked(updateIfStatus).mockResolvedValue(false)
    await recoverStaleClaims(db, config)
    expect(postMessageSafe).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
  })

  it('skips fresh claims and other workers', async () => {
    vi.mocked(listByStatus).mockResolvedValue([
      row({ claimed_at: new Date().toISOString() }),
      row({ claimed_by: 'someone-else' }),
    ])
    await recoverStaleClaims(db, config)
    expect(updateIfStatus).not.toHaveBeenCalled()
  })
})
