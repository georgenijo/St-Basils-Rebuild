import { beforeEach, describe, expect, it, vi } from 'vitest'

import { cleanupClosedRequests } from './closed'
import {
  listClosedPendingCleanup,
  postMessageSafe,
  recordMerge,
  updateIfStatus,
  type Db,
} from './db'
import type { GitHub } from './github'
import type { ChangeRequest } from './types'

vi.mock('./db', () => ({
  listClosedPendingCleanup: vi.fn(),
  postMessageSafe: vi.fn(),
  recordMerge: vi.fn(),
  updateIfStatus: vi.fn(),
}))

const MERGE_SHA = 'c'.repeat(40)
const HEAD_SHA = 'a'.repeat(40)

const db = {} as Db

function closedRequest(overrides: Partial<ChangeRequest> = {}): ChangeRequest {
  return {
    id: 'abcd1234-5678-90ab-cdef-1234567890ab',
    requester_id: 'user-1',
    title: 'PRIVATE title',
    description: 'PRIVATE description',
    page_path: '/',
    target_selector: null,
    target_text: null,
    status: 'closed',
    branch_name: 'change-request/abcd1234-website-update',
    pr_number: 12,
    pr_url: 'https://github.com/x/y/pull/12',
    preview_url: null,
    verification: null,
    revision_base_sha: null,
    github_cleanup_pending: true,
    claimed_by: null,
    claimed_at: null,
    attempts: 1,
    error: null,
    created_at: '2026-09-30T00:00:00Z',
    updated_at: '2026-09-30T00:00:00Z',
    ...overrides,
  }
}

function fakeGh() {
  return {
    findLatestPullForBranch: vi.fn().mockResolvedValue(null),
    pullState: vi
      .fn()
      .mockResolvedValueOnce({ state: 'open', merged: false, mergeCommitSha: null, headSha: null })
      .mockResolvedValue({ state: 'closed', merged: false, mergeCommitSha: null, headSha: null }),
    comment: vi.fn().mockResolvedValue(undefined),
    closePull: vi.fn().mockResolvedValue(undefined),
    deleteBranch: vi.fn().mockResolvedValue(true),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(updateIfStatus).mockResolvedValue(true)
  vi.mocked(postMessageSafe).mockResolvedValue(undefined)
})

describe('cleanupClosedRequests', () => {
  it('closes the open PR with a public-safe comment, deletes the branch, and clears the flag', async () => {
    vi.mocked(listClosedPendingCleanup).mockResolvedValue([closedRequest()])
    const gh = fakeGh()

    await cleanupClosedRequests(db, gh as unknown as GitHub)

    expect(gh.comment).toHaveBeenCalledWith(12, expect.stringContaining('withdrawn'))
    expect(gh.comment.mock.calls[0][1]).not.toContain('PRIVATE')
    expect(gh.closePull).toHaveBeenCalledWith(12)
    expect(gh.deleteBranch).toHaveBeenCalledWith('change-request/abcd1234-website-update')
    expect(updateIfStatus).toHaveBeenCalledWith(db, expect.any(String), 'closed', {
      github_cleanup_pending: false,
    })
    expect(vi.mocked(postMessageSafe).mock.calls[0][3]).toBe(
      'Closed pull request #12. Deleted branch change-request/abcd1234-website-update.'
    )
  })

  it('records a PR that was already merged as merged instead of withdrawing it', async () => {
    vi.mocked(listClosedPendingCleanup).mockResolvedValue([closedRequest()])
    const gh = fakeGh()
    gh.pullState.mockReset().mockResolvedValue({
      state: 'closed',
      merged: true,
      mergeCommitSha: MERGE_SHA,
      headSha: HEAD_SHA,
    })

    await cleanupClosedRequests(db, gh as unknown as GitHub)

    expect(gh.closePull).not.toHaveBeenCalled()
    // Recorded durably (status, merge commit, explanation) in one transaction.
    expect(recordMerge).toHaveBeenCalledWith(db, expect.any(String), MERGE_SHA, HEAD_SHA)
    expect(updateIfStatus).not.toHaveBeenCalled()
  })

  it('never deletes a branch the worker did not create', async () => {
    vi.mocked(listClosedPendingCleanup).mockResolvedValue([
      closedRequest({ pr_number: null, branch_name: 'main' }),
    ])
    const gh = fakeGh()

    await cleanupClosedRequests(db, gh as unknown as GitHub)

    expect(gh.deleteBranch).not.toHaveBeenCalled()
    expect(updateIfStatus).toHaveBeenCalledTimes(1)
  })

  it('finds the branch and PR of a failed attempt that never recorded them', async () => {
    vi.mocked(listClosedPendingCleanup).mockResolvedValue([
      closedRequest({ pr_number: null, branch_name: null }),
    ])
    const gh = fakeGh()
    gh.findLatestPullForBranch.mockResolvedValue({ number: 77 })

    await cleanupClosedRequests(db, gh as unknown as GitHub)

    expect(gh.findLatestPullForBranch).toHaveBeenCalledWith(
      'change-request/abcd1234-website-update'
    )
    // Persisted first, so a retry after a later failure still knows the PR.
    expect(updateIfStatus).toHaveBeenNthCalledWith(1, db, expect.any(String), 'closed', {
      pr_number: 77,
    })
    expect(gh.closePull).toHaveBeenCalledWith(77)
    expect(gh.deleteBranch).toHaveBeenCalledWith('change-request/abcd1234-website-update')
  })

  it('records a merge that raced with closing the PR', async () => {
    vi.mocked(listClosedPendingCleanup).mockResolvedValue([closedRequest()])
    const gh = fakeGh()
    gh.pullState
      .mockReset()
      .mockResolvedValueOnce({ state: 'open', merged: false, mergeCommitSha: null, headSha: null })
      .mockResolvedValue({
        state: 'closed',
        merged: true,
        mergeCommitSha: MERGE_SHA,
        headSha: HEAD_SHA,
      })

    await cleanupClosedRequests(db, gh as unknown as GitHub)

    expect(recordMerge).toHaveBeenCalledWith(db, expect.any(String), MERGE_SHA, HEAD_SHA)
  })

  it('does nothing at all in a dry run', async () => {
    vi.mocked(listClosedPendingCleanup).mockResolvedValue([closedRequest()])
    const gh = fakeGh()

    await cleanupClosedRequests(db, gh as unknown as GitHub, { dryRun: true })

    expect(listClosedPendingCleanup).not.toHaveBeenCalled()
    expect(gh.comment).not.toHaveBeenCalled()
    expect(gh.closePull).not.toHaveBeenCalled()
    expect(gh.deleteBranch).not.toHaveBeenCalled()
  })

  it('leaves the flag set to retry later when GitHub fails, and keeps going', async () => {
    vi.mocked(listClosedPendingCleanup).mockResolvedValue([
      closedRequest(),
      closedRequest({ id: 'second', pr_number: 13, branch_name: null }),
    ])
    const gh = fakeGh()
    gh.closePull.mockRejectedValueOnce(new Error('GitHub 502'))

    await cleanupClosedRequests(db, gh as unknown as GitHub)

    expect(updateIfStatus).toHaveBeenCalledTimes(1)
    expect(updateIfStatus).toHaveBeenCalledWith(db, 'second', 'closed', {
      github_cleanup_pending: false,
    })
  })

  it('finds an unrecorded PR that was already merged and records the merge', async () => {
    vi.mocked(listClosedPendingCleanup).mockResolvedValue([
      closedRequest({ pr_number: null, branch_name: null }),
    ])
    const gh = fakeGh()
    gh.findLatestPullForBranch.mockResolvedValue({ number: 78 })
    gh.pullState.mockReset().mockResolvedValue({
      state: 'closed',
      merged: true,
      mergeCommitSha: MERGE_SHA,
      headSha: HEAD_SHA,
    })

    await cleanupClosedRequests(db, gh as unknown as GitHub)

    expect(gh.closePull).not.toHaveBeenCalled()
    expect(recordMerge).toHaveBeenCalledWith(db, expect.any(String), MERGE_SHA, HEAD_SHA)
  })
})
