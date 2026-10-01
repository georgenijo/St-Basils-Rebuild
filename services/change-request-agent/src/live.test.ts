import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Config } from './config'
import { listMergedAwaitingLive, postMessageSafe, updateIfStatus, type Db } from './db'
import type { GitHub } from './github'
import { LIVE_DEPLOY_TIMEOUT_MS, confirmLiveDeployments, selectProductionDeployment } from './live'
import type { DeploymentWithStatuses } from './preview'
import type { ChangeRequest } from './types'

vi.mock('./db', () => ({
  listMergedAwaitingLive: vi.fn(),
  postMessageSafe: vi.fn(),
  updateIfStatus: vi.fn(),
}))

const db = {} as Db
const config = { siteUrl: 'https://stbasilsboston.org' } as Config
const MERGE = 'c'.repeat(40)
const LATER = 'd'.repeat(40)
const NOW = new Date('2026-10-01T12:00:00Z')

function merged(overrides: Partial<ChangeRequest> = {}): ChangeRequest {
  return {
    id: 'req-1',
    requester_id: 'u',
    title: 't',
    description: 'd',
    page_path: '/giving',
    target_selector: null,
    target_text: null,
    status: 'merged',
    branch_name: null,
    pr_number: 12,
    pr_url: null,
    preview_url: null,
    verification: null,
    revision_base_sha: null,
    merge_commit_sha: MERGE,
    merged_at: new Date(NOW.getTime() - 60_000).toISOString(),
    claimed_by: null,
    claimed_at: null,
    attempts: 1,
    error: null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  }
}

function deployment(
  sha: string,
  state: string,
  environment = 'Production'
): DeploymentWithStatuses {
  return {
    id: 1,
    sha,
    environment,
    created_at: '2026-10-01T11:59:00Z',
    statuses: [{ state, created_at: '2026-10-01T11:59:30Z' }],
  }
}

function fakeGh(
  own: DeploymentWithStatuses[],
  latest: DeploymentWithStatuses[] = [],
  contains = false
) {
  return {
    deploymentsForSha: vi.fn().mockResolvedValue(own),
    latestProductionDeployments: vi.fn().mockResolvedValue(latest),
    commitContains: vi.fn().mockResolvedValue(contains),
  }
}

const run = (gh: ReturnType<typeof fakeGh>, fetchPage = vi.fn().mockResolvedValue(200)) =>
  confirmLiveDeployments(db, gh as unknown as GitHub, config, { fetchPage, now: () => NOW })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(updateIfStatus).mockResolvedValue(true)
  vi.mocked(listMergedAwaitingLive).mockResolvedValue([merged()])
})

describe('selectProductionDeployment', () => {
  it('ignores previews and reads the newest production status', () => {
    expect(selectProductionDeployment([deployment(MERGE, 'success', 'Preview')])).toBeNull()
    expect(selectProductionDeployment([deployment(MERGE, 'success')])).toEqual({
      state: 'ready',
      sha: MERGE,
    })
    expect(selectProductionDeployment([deployment(MERGE, 'inactive')])).toMatchObject({
      state: 'ready',
    })
    expect(selectProductionDeployment([deployment(MERGE, 'in_progress')])).toEqual({
      state: 'pending',
    })
    expect(selectProductionDeployment([deployment(MERGE, 'failure')])).toMatchObject({
      state: 'failed',
    })
  })
})

describe('confirmLiveDeployments', () => {
  it('marks the request live and posts the live link once the page responds', async () => {
    const fetchPage = vi.fn().mockResolvedValue(200)
    await run(fakeGh([deployment(MERGE, 'success')]), fetchPage)
    expect(fetchPage).toHaveBeenCalledWith('https://stbasilsboston.org/giving')
    expect(updateIfStatus).toHaveBeenCalledWith(db, 'req-1', 'merged', {
      status: 'live',
      live_at: NOW.toISOString(),
      error: null,
    })
    expect(postMessageSafe).toHaveBeenCalledWith(
      db,
      'req-1',
      'system',
      'Live on site ↗ https://stbasilsboston.org/giving'
    )
  })

  it('counts a newer production deployment that contains the merge commit', async () => {
    const gh = fakeGh([], [deployment(LATER, 'success')], true)
    await run(gh)
    expect(gh.commitContains).toHaveBeenCalledWith(LATER, MERGE)
    expect(updateIfStatus).toHaveBeenCalledWith(
      db,
      'req-1',
      'merged',
      expect.objectContaining({ status: 'live' })
    )
  })

  it('reports a failed production deployment once and does not mark it live', async () => {
    await run(fakeGh([deployment(MERGE, 'failure')]))
    expect(updateIfStatus).toHaveBeenCalledWith(db, 'req-1', 'merged', {
      live_check_failed_at: NOW.toISOString(),
      error: expect.stringContaining('production deployment reported "failure"'),
    })
    expect(vi.mocked(postMessageSafe).mock.calls[0][3]).toMatch(/^Not confirmed live:/)
  })

  it('reports a missing deployment only after the timeout', async () => {
    await run(fakeGh([]))
    expect(updateIfStatus).not.toHaveBeenCalled()

    vi.mocked(listMergedAwaitingLive).mockResolvedValue([
      merged({ merged_at: new Date(NOW.getTime() - LIVE_DEPLOY_TIMEOUT_MS - 1).toISOString() }),
    ])
    await run(fakeGh([]))
    expect(updateIfStatus).toHaveBeenCalledWith(
      db,
      'req-1',
      'merged',
      expect.objectContaining({ error: expect.stringContaining('no successful Vercel production') })
    )
  })

  it('flags a live page that does not respond with success', async () => {
    await run(fakeGh([deployment(MERGE, 'success')]), vi.fn().mockResolvedValue(500))
    expect(updateIfStatus).toHaveBeenCalledWith(
      db,
      'req-1',
      'merged',
      expect.objectContaining({ error: expect.stringContaining('returned HTTP 500') })
    )
  })

  it('retries later when the live page cannot be reached at all', async () => {
    await run(fakeGh([deployment(MERGE, 'success')]), vi.fn().mockRejectedValue(new Error('dns')))
    expect(updateIfStatus).not.toHaveBeenCalled()
  })

  it('polls a pending deployment until it is ready when asked to wait', async () => {
    const gh = fakeGh([])
    gh.deploymentsForSha
      .mockResolvedValueOnce([deployment(MERGE, 'in_progress')])
      .mockResolvedValue([deployment(MERGE, 'success')])
    let clock = NOW.getTime()
    await confirmLiveDeployments(db, gh as unknown as GitHub, config, {
      fetchPage: vi.fn().mockResolvedValue(200),
      now: () => new Date((clock += 1_000)),
      waitMs: 60_000,
      pollMs: 1,
    })
    expect(gh.deploymentsForSha).toHaveBeenCalledTimes(2)
    expect(updateIfStatus).toHaveBeenCalledWith(
      db,
      'req-1',
      'merged',
      expect.objectContaining({ status: 'live' })
    )
  })

  it('does nothing in a dry run', async () => {
    const gh = fakeGh([deployment(MERGE, 'success')])
    await confirmLiveDeployments(db, gh as unknown as GitHub, config, { dryRun: true })
    expect(listMergedAwaitingLive).not.toHaveBeenCalled()
  })
})
