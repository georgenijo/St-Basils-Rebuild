import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Config } from './config'
import { listMergedAwaitingLive, recordLiveCheck, updateIfStatus, type Db } from './db'
import type { GitHub } from './github'
import {
  LIVE_DEPLOY_TIMEOUT_MS,
  confirmLiveDeployments,
  currentProduction,
  ownDeploymentFailed,
} from './live'
import type { DeploymentWithStatuses } from './preview'
import type { ChangeRequest } from './types'

vi.mock('./db', () => ({
  listMergedAwaitingLive: vi.fn(),
  recordLiveCheck: vi.fn(),
  updateIfStatus: vi.fn(),
}))

const db = {} as Db
const config = { siteUrl: 'https://stbasilsboston.org' } as Config
const MERGE = 'c'.repeat(40)
const LATER = 'd'.repeat(40)
const OLDER = 'e'.repeat(40)
const NOW = new Date('2026-10-01T12:00:00Z')
const LATE = new Date(NOW.getTime() - LIVE_DEPLOY_TIMEOUT_MS - 1).toISOString()

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
  createdAt = '2026-10-01T11:59:00Z'
): DeploymentWithStatuses {
  return {
    id: 1,
    sha,
    environment: 'Production',
    created_at: createdAt,
    statuses: [{ state, created_at: createdAt }],
  }
}

function fakeGh({
  production = [] as DeploymentWithStatuses[],
  own = [] as DeploymentWithStatuses[],
  contains = false,
} = {}) {
  return {
    latestProductionDeployments: vi.fn().mockResolvedValue(production),
    deploymentsForSha: vi.fn().mockResolvedValue(own),
    commitContains: vi.fn().mockResolvedValue(contains),
    pullState: vi.fn().mockResolvedValue({
      state: 'closed',
      merged: true,
      mergeCommitSha: MERGE,
      headSha: 'a'.repeat(40),
      mergedAt: '2026-10-01T11:58:00Z',
    }),
  }
}

const run = (gh: ReturnType<typeof fakeGh>, fetchPage = vi.fn().mockResolvedValue(200)) =>
  confirmLiveDeployments(db, gh as unknown as GitHub, config, { fetchPage, now: () => NOW })

function outcome() {
  return vi.mocked(recordLiveCheck).mock.calls.map(([, , kind, message]) => ({ kind, message }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(recordLiveCheck).mockResolvedValue(true)
  vi.mocked(updateIfStatus).mockResolvedValue(true)
  vi.mocked(listMergedAwaitingLive).mockResolvedValue([merged()])
})

describe('production selection', () => {
  it('treats only the newest successful production deployment as current', () => {
    expect(
      currentProduction([
        deployment(OLDER, 'success', '2026-10-01T10:00:00Z'),
        deployment(MERGE, 'inactive', '2026-10-01T11:00:00Z'),
      ])
    ).toBe(OLDER)
    expect(currentProduction([{ ...deployment(MERGE, 'success'), environment: 'Preview' }])).toBe(
      null
    )
    expect(ownDeploymentFailed([deployment(MERGE, 'error')])).toBe('error')
    expect(ownDeploymentFailed([deployment(MERGE, 'in_progress')])).toBeNull()
  })
})

describe('confirmLiveDeployments', () => {
  it('marks the request live with the live link once production serves it and the page loads', async () => {
    const fetchPage = vi.fn().mockResolvedValue(200)
    await run(fakeGh({ production: [deployment(MERGE, 'success')] }), fetchPage)
    expect(fetchPage).toHaveBeenCalledWith('https://stbasilsboston.org/giving')
    expect(recordLiveCheck).toHaveBeenCalledWith(
      db,
      'req-1',
      'live',
      'Live on site ↗ https://stbasilsboston.org/giving'
    )
  })

  it('never confirms a merge production rolled back (its deployment is only inactive)', async () => {
    const gh = fakeGh({
      production: [
        deployment(OLDER, 'success', '2026-10-01T11:59:30Z'),
        deployment(MERGE, 'inactive', '2026-10-01T11:58:00Z'),
      ],
      own: [deployment(MERGE, 'inactive')],
      contains: false,
    })
    await run(gh)
    expect(gh.commitContains).toHaveBeenCalledWith(OLDER, MERGE)
    expect(recordLiveCheck).not.toHaveBeenCalled()
  })

  it('confirms a merge whose own build is stuck pending once a descendant is live', async () => {
    const gh = fakeGh({
      production: [deployment(LATER, 'success')],
      own: [deployment(MERGE, 'queued')],
      contains: true,
    })
    await run(gh)
    expect(outcome()).toEqual([{ kind: 'live', message: expect.stringContaining('Live on site') }])
  })

  it('reports a failed production deployment of the merge', async () => {
    await run(fakeGh({ own: [deployment(MERGE, 'failure')] }))
    expect(outcome()).toEqual([
      {
        kind: 'failed',
        message: expect.stringMatching(
          /^Not confirmed live: the production deployment reported "failure"/
        ),
      },
    ])
  })

  it('reports a missing deployment only after the deadline', async () => {
    await run(fakeGh())
    expect(recordLiveCheck).not.toHaveBeenCalled()

    vi.mocked(listMergedAwaitingLive).mockResolvedValue([merged({ merged_at: LATE })])
    await run(fakeGh())
    expect(outcome()[0].message).toMatch(/no Vercel production deployment containing/)
  })

  it('retries a failing page until the deadline, then reports it', async () => {
    const live = { production: [deployment(MERGE, 'success')] }
    await run(fakeGh(live), vi.fn().mockResolvedValue(500))
    await run(fakeGh(live), vi.fn().mockRejectedValue(new Error('dns')))
    expect(recordLiveCheck).not.toHaveBeenCalled()

    vi.mocked(listMergedAwaitingLive).mockResolvedValue([merged({ merged_at: LATE })])
    await run(fakeGh(live), vi.fn().mockResolvedValue(500))
    expect(outcome()[0].message).toMatch(/returned HTTP 500/)
    vi.clearAllMocks()
    vi.mocked(listMergedAwaitingLive).mockResolvedValue([merged({ merged_at: LATE })])
    await run(fakeGh(live), vi.fn().mockRejectedValue(new Error('dns')))
    expect(outcome()[0].message).toMatch(/could not be loaded/)
  })

  it('reports GitHub lookups that keep failing after the deadline', async () => {
    vi.mocked(listMergedAwaitingLive).mockResolvedValue([merged({ merged_at: LATE })])
    const gh = fakeGh()
    gh.latestProductionDeployments.mockRejectedValue(new Error('GitHub 502'))
    await run(gh)
    expect(outcome()[0].message).toMatch(/the live check kept failing/)
  })

  it('recovers a missing merge commit from the PR instead of skipping the request', async () => {
    vi.mocked(listMergedAwaitingLive).mockResolvedValue([
      merged({ merge_commit_sha: null, merged_at: null }),
    ])
    const gh = fakeGh({ production: [deployment(MERGE, 'success')] })
    await run(gh)
    expect(gh.pullState).toHaveBeenCalledWith(12)
    expect(updateIfStatus).toHaveBeenCalledWith(db, 'req-1', 'merged', {
      merge_commit_sha: MERGE,
      merged_at: '2026-10-01T11:58:00Z',
    })
    expect(outcome()[0].kind).toBe('live')
  })

  it('reports a request whose merge commit cannot be found', async () => {
    vi.mocked(listMergedAwaitingLive).mockResolvedValue([
      merged({ merge_commit_sha: null, pr_number: null }),
    ])
    await run(fakeGh())
    expect(outcome()[0].message).toMatch(/merge commit could not be found/)
  })

  it('keeps a request whose lookup errored in the wait loop and retries it', async () => {
    const gh = fakeGh({ production: [deployment(MERGE, 'success')] })
    gh.latestProductionDeployments
      .mockRejectedValueOnce(new Error('GitHub 502'))
      .mockResolvedValue([deployment(MERGE, 'success')])
    let clock = NOW.getTime()
    await confirmLiveDeployments(db, gh as unknown as GitHub, config, {
      fetchPage: vi.fn().mockResolvedValue(200),
      now: () => new Date((clock += 1_000)),
      waitMs: 60_000,
      sleep: async () => {},
    })
    expect(gh.latestProductionDeployments).toHaveBeenCalledTimes(2)
    expect(outcome()[0].kind).toBe('live')
  })

  it('stops waiting promptly when the worker shuts down', async () => {
    let shuttingDown = false
    const sleep = vi.fn(async () => {
      shuttingDown = true
    })
    const gh = fakeGh()
    await confirmLiveDeployments(db, gh as unknown as GitHub, config, {
      now: () => NOW,
      waitMs: 10 * 60_000,
      sleep,
      isShuttingDown: () => shuttingDown,
    })
    expect(sleep).toHaveBeenCalledTimes(1)
    expect(gh.latestProductionDeployments).toHaveBeenCalledTimes(1)
  })

  it('does nothing in a dry run', async () => {
    await confirmLiveDeployments(db, fakeGh() as unknown as GitHub, config, { dryRun: true })
    expect(listMergedAwaitingLive).not.toHaveBeenCalled()
  })
})
