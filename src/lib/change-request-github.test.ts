import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { warn } = vi.hoisted(() => ({ warn: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { child: () => ({ info: vi.fn(), warn }) } }))

import {
  checkMergeReadiness,
  isChangeRequestMergeConfigured,
  mergeChangeRequestPull,
  requiredChecksPassed,
} from './change-request-github'

const SHA = 'a'.repeat(40)
const TOKEN = 'synthetic-github-token'
const mockFetch = vi.fn()

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

function pull(overrides: Record<string, unknown> = {}) {
  return {
    state: 'open',
    merged: false,
    draft: false,
    mergeable: true,
    head: { sha: SHA },
    base: { ref: 'main' },
    ...overrides,
  }
}

function checks(conclusions: Record<string, string | null> = {}) {
  return {
    check_runs: [
      'Validate',
      'Unit Tests',
      'Change Request Agent Service',
      'Browser Flow Tests',
    ].map((name, index) => ({
      id: index + 1,
      name,
      status: conclusions[name] === null ? 'in_progress' : 'completed',
      conclusion: name in conclusions ? conclusions[name] : 'success',
    })),
  }
}

function route(pullBody: unknown, checkBody: unknown = checks()) {
  mockFetch.mockImplementation(async (url: string) =>
    String(url).includes('/check-runs') ? json(checkBody) : json(pullBody)
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', mockFetch)
  vi.stubEnv('CHANGE_REQUEST_GITHUB_TOKEN', TOKEN)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('configuration', () => {
  it('is off without a token, and then never calls GitHub', async () => {
    vi.stubEnv('CHANGE_REQUEST_GITHUB_TOKEN', '')
    expect(isChangeRequestMergeConfigured()).toBe(false)
    expect((await checkMergeReadiness({ prNumber: 1, verifiedSha: SHA })).ok).toBe(false)
    expect((await mergeChangeRequestPull(1, SHA)).ok).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('checkMergeReadiness', () => {
  it('is ready when the open PR head is the verified commit and all required checks passed', async () => {
    route(pull())
    expect(await checkMergeReadiness({ prNumber: 12, verifiedSha: SHA })).toEqual({ ok: true })
    const [pullUrl, init] = mockFetch.mock.calls[0]
    expect(pullUrl).toBe('https://api.github.com/repos/georgenijo/St-Basils-Rebuild/pulls/12')
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`)
    expect(mockFetch.mock.calls[1][0]).toContain(`/commits/${SHA}/check-runs`)
  })

  it.each([
    [pull({ head: { sha: 'b'.repeat(40) } }), /changed since it was verified/],
    [pull({ draft: true }), /draft/],
    [pull({ state: 'closed' }), /closed/],
    [pull({ state: 'closed', merged: true }), /already merged/],
    [pull({ mergeable: false }), /merge conflicts/],
    [pull({ mergeable: null }), /still checking/],
    [pull({ base: { ref: 'not-main' } }), /does not target main/],
  ])('refuses a PR that is not mergeable as verified (%#)', async (body, reason) => {
    route(body)
    const readiness = await checkMergeReadiness({ prNumber: 12, verifiedSha: SHA })
    expect(readiness.ok).toBe(false)
    expect(readiness.ok ? '' : readiness.reason).toMatch(reason)
  })

  it('refuses without a verified commit', async () => {
    expect((await checkMergeReadiness({ prNumber: 12, verifiedSha: null })).ok).toBe(false)
    expect((await checkMergeReadiness({ prNumber: 12, verifiedSha: 'abc' })).ok).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('refuses when a required check failed, is running, or is missing', async () => {
    route(pull(), checks({ 'Browser Flow Tests': 'failure' }))
    expect(await checkMergeReadiness({ prNumber: 12, verifiedSha: SHA })).toEqual({
      ok: false,
      reason: 'The "Browser Flow Tests" check did not pass.',
    })
    route(pull(), checks({ Validate: null }))
    expect(await checkMergeReadiness({ prNumber: 12, verifiedSha: SHA })).toMatchObject({
      reason: 'The "Validate" check is still running.',
    })
    route(pull(), { check_runs: checks().check_runs.slice(1) })
    expect(await checkMergeReadiness({ prNumber: 12, verifiedSha: SHA })).toMatchObject({
      reason: 'The "Validate" check has not run yet.',
    })
  })

  it('reports GitHub being unreachable without throwing', async () => {
    mockFetch.mockRejectedValue(new Error('network down'))
    expect(await checkMergeReadiness({ prNumber: 12, verifiedSha: SHA })).toEqual({
      ok: false,
      reason: 'Could not reach GitHub.',
      retryable: true,
    })
  })
})

describe('requiredChecksPassed', () => {
  it('judges the newest attempt of each check (a rerun can fix or break it)', () => {
    const base = checks().check_runs
    expect(
      requiredChecksPassed([
        ...base,
        { id: 99, name: 'Unit Tests', status: 'completed', conclusion: 'failure' },
      ]).ok
    ).toBe(false)
    expect(
      requiredChecksPassed([
        { id: 0, name: 'Unit Tests', status: 'completed', conclusion: 'failure' },
        ...base,
      ]).ok
    ).toBe(true)
    expect(
      requiredChecksPassed(
        base.map((run) => (run.name === 'Validate' ? { ...run, conclusion: 'skipped' } : run))
      ).ok
    ).toBe(false)
  })
})

describe('mergeChangeRequestPull', () => {
  it('squash-merges pinned to the verified commit and returns the merge commit', async () => {
    mockFetch.mockResolvedValue(json({ merged: true, sha: 'c'.repeat(40) }))
    expect(await mergeChangeRequestPull(12, SHA)).toEqual({
      ok: true,
      mergeCommitSha: 'c'.repeat(40),
    })
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('/pulls/12/merge')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toEqual({ sha: SHA, merge_method: 'squash' })
  })

  it('reports a head that moved (409) or an unmergeable PR (405)', async () => {
    mockFetch.mockResolvedValueOnce(json({ message: 'Head branch was modified' }, 409))
    expect(await mergeChangeRequestPull(12, SHA)).toEqual({
      ok: false,
      reason: 'The pull request changed since it was verified.',
    })
    mockFetch.mockResolvedValueOnce(json({ message: 'not mergeable' }, 405))
    expect((await mergeChangeRequestPull(12, SHA)).ok).toBe(false)
  })

  it('treats a timeout or server error as uncertain, never as refused', async () => {
    mockFetch.mockRejectedValueOnce(new Error('timeout'))
    expect(await mergeChangeRequestPull(12, SHA)).toEqual({
      ok: false,
      reason: 'GitHub did not confirm the merge.',
      uncertain: true,
    })
    mockFetch.mockResolvedValueOnce(json({ message: 'oops' }, 502))
    expect(await mergeChangeRequestPull(12, SHA)).toMatchObject({ uncertain: true })
    mockFetch.mockResolvedValueOnce(json({ message: 'nope' }, 405))
    expect(await mergeChangeRequestPull(12, SHA)).not.toHaveProperty('uncertain')
  })
})
