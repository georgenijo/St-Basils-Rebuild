import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  listByStatus,
  postMessageSafe,
  recordMerge,
  releaseMerge,
  updateIfStatus,
  type Db,
} from './db'
import type { GitHub } from './github'
import { MERGE_CONFIRM_GRACE_MS, syncPullRequests } from './pr-sync'
import type { ChangeRequest } from './types'

vi.mock('./db', () => ({
  listByStatus: vi.fn(),
  postMessageSafe: vi.fn(),
  recordMerge: vi.fn(),
  releaseMerge: vi.fn(),
  updateIfStatus: vi.fn(),
}))

const db = {} as Db
const NOW = new Date('2026-10-01T12:00:00Z')
const MERGE_SHA = 'c'.repeat(40)

function row(overrides: Partial<ChangeRequest> = {}): ChangeRequest {
  return {
    id: 'req-1',
    requester_id: 'user-1',
    title: 't',
    description: 'd',
    page_path: '/',
    target_selector: null,
    target_text: null,
    status: 'ready_for_review',
    branch_name: 'change-request/abcd1234-website-update',
    pr_number: 12,
    pr_url: null,
    preview_url: null,
    verification: null,
    revision_base_sha: null,
    claimed_by: null,
    claimed_at: null,
    attempts: 1,
    error: null,
    created_at: '2026-09-30T00:00:00Z',
    updated_at: '2026-09-30T00:00:00Z',
    ...overrides,
  }
}

function gh(state: 'open' | 'closed', merged = false) {
  return {
    pullState: vi.fn().mockResolvedValue({
      state,
      merged,
      mergeCommitSha: merged ? MERGE_SHA : null,
      headSha: 'a'.repeat(40),
    }),
  } as unknown as GitHub
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(recordMerge).mockResolvedValue(true)
  vi.mocked(releaseMerge).mockResolvedValue(true)
  vi.mocked(updateIfStatus).mockResolvedValue(true)
})

describe('syncPullRequests', () => {
  it('also reconciles Approve & merge reservations', async () => {
    vi.mocked(listByStatus).mockResolvedValue([])
    await syncPullRequests(db, gh('open'), NOW)
    expect(listByStatus).toHaveBeenCalledWith(db, [
      'ready_for_review',
      'needs_attention',
      'merging',
    ])
  })

  it('records a merge (status, merge commit, thread) for a PR merged on GitHub', async () => {
    vi.mocked(listByStatus).mockResolvedValue([row()])
    await syncPullRequests(db, gh('closed', true), NOW)
    expect(recordMerge).toHaveBeenCalledWith(db, 'req-1', MERGE_SHA, 'a'.repeat(40))
    expect(updateIfStatus).not.toHaveBeenCalled()
  })

  it('finishes a reservation whose merge succeeded but was not recorded', async () => {
    vi.mocked(listByStatus).mockResolvedValue([
      row({ status: 'merging', approval_id: 'approval-1', approved_at: NOW.toISOString() }),
    ])
    await syncPullRequests(db, gh('closed', true), NOW)
    expect(recordMerge).toHaveBeenCalledWith(db, 'req-1', MERGE_SHA, 'a'.repeat(40))
    expect(releaseMerge).not.toHaveBeenCalled()
  })

  it('leaves a fresh reservation alone while the site may still be merging', async () => {
    vi.mocked(listByStatus).mockResolvedValue([
      row({
        status: 'merging',
        approval_id: 'approval-1',
        approved_at: new Date(NOW.getTime() - 60_000).toISOString(),
      }),
    ])
    await syncPullRequests(db, gh('open'), NOW)
    expect(releaseMerge).not.toHaveBeenCalled()
    expect(recordMerge).not.toHaveBeenCalled()
  })

  it('releases a reservation that was never merged after the grace period', async () => {
    vi.mocked(listByStatus).mockResolvedValue([
      row({
        status: 'merging',
        approval_id: 'approval-1',
        approved_at: new Date(NOW.getTime() - MERGE_CONFIRM_GRACE_MS - 1).toISOString(),
      }),
    ])
    await syncPullRequests(db, gh('open'), NOW)
    // Only this reservation, and the database re-checks its age.
    expect(releaseMerge).toHaveBeenCalledWith(
      db,
      'req-1',
      'approval-1',
      expect.stringContaining('not confirmed'),
      '10 minutes'
    )
  })

  it('closes a reserved request whose PR was closed without merging', async () => {
    vi.mocked(listByStatus).mockResolvedValue([
      row({ status: 'merging', approval_id: 'approval-1' }),
    ])
    await syncPullRequests(db, gh('closed', false), NOW)
    expect(releaseMerge).toHaveBeenCalledTimes(1)
    expect(updateIfStatus).toHaveBeenCalledWith(db, 'req-1', 'ready_for_review', {
      status: 'closed',
      error: null,
    })
    expect(postMessageSafe).toHaveBeenCalledWith(
      db,
      'req-1',
      'system',
      'Pull request #12 was closed without merging.'
    )
  })

  it('marks other PRs closed without merging as closed', async () => {
    vi.mocked(listByStatus).mockResolvedValue([row({ status: 'needs_attention' })])
    await syncPullRequests(db, gh('closed', false), NOW)
    expect(updateIfStatus).toHaveBeenCalledWith(db, 'req-1', 'needs_attention', {
      status: 'closed',
      error: null,
    })
    expect(releaseMerge).not.toHaveBeenCalled()
  })

  it('keeps going when one PR lookup fails', async () => {
    vi.mocked(listByStatus).mockResolvedValue([row({ id: 'a' }), row({ id: 'b' })])
    const client = {
      pullState: vi
        .fn()
        .mockRejectedValueOnce(new Error('GitHub 502'))
        .mockResolvedValue({
          state: 'closed',
          merged: true,
          mergeCommitSha: MERGE_SHA,
          headSha: 'h'.repeat(40),
        }),
    } as unknown as GitHub
    await syncPullRequests(db, client, NOW)
    expect(recordMerge).toHaveBeenCalledTimes(1)
    expect(recordMerge).toHaveBeenCalledWith(db, 'b', MERGE_SHA, 'h'.repeat(40))
  })

  it('does not close the request when another approval took over the reservation', async () => {
    vi.mocked(listByStatus).mockResolvedValue([
      row({ status: 'merging', approval_id: 'approval-1' }),
    ])
    vi.mocked(releaseMerge).mockResolvedValue(false)
    await syncPullRequests(db, gh('closed', false), NOW)
    expect(updateIfStatus).not.toHaveBeenCalled()
  })
})
