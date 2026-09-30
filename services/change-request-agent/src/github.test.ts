import { afterEach, describe, expect, it, vi } from 'vitest'

import { loadConfig } from './config'
import { createGitHub } from './github'
import { buildVerdictComment } from './prbody'

const SERVICE_KEY = 'service-role-key-exact-value-0123456789'
const BYPASS = 'vercel-bypass-exact-value-abcdef'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('createGitHub comment publishing', () => {
  it('redacts configured secret values from verdict comments', async () => {
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', SERVICE_KEY)
    vi.stubEnv('VERCEL_AUTOMATION_BYPASS_SECRET', BYPASS)
    vi.stubEnv('GITHUB_TOKEN', 'plain-looking-github-token-value-xyz')
    const config = loadConfig()
    const fetchMock = vi.fn(async () => new Response('{}', { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const comment = buildVerdictComment(
      {
        verdict: 'fail',
        summary: `The page printed ${SERVICE_KEY} and ${BYPASS}; mail a@b.org`,
        checks: [{ name: 'no new uncaught page errors (desktop)', ok: false, detail: BYPASS }],
        commit_sha: 'abcdef1234567',
      },
      'https://x.vercel.app'
    )
    // Defense in depth still redacts accidental secret-bearing caller text.
    await createGitHub(config).comment(343, `${comment}\n${SERVICE_KEY} ${BYPASS} a@b.org`)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/issues/343/comments')
    const body = JSON.parse(String(init.body)).body as string
    expect(body).not.toContain(SERVICE_KEY)
    expect(body).not.toContain(BYPASS)
    expect(body).not.toContain('a@b.org')
    expect(body).toContain('[redacted]')
    expect(body).toContain('Preview verification: FAIL')
  })
})

function configuredGitHub() {
  vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', SERVICE_KEY)
  vi.stubEnv('GITHUB_TOKEN', 'plain-looking-github-token-value-xyz')
  return createGitHub(loadConfig())
}

describe('openOrUpdatePull draft behavior', () => {
  it('opens a new pull request as a draft', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/pulls?state=open')) return new Response('[]', { status: 200 })
      return new Response(
        JSON.stringify({ number: 12, html_url: 'https://github.com/x/y/pull/12' }),
        { status: 201 }
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const gh = configuredGitHub()
    const pr = await gh.openOrUpdatePull({
      branch: 'change-request/abcd1234-x',
      base: 'main',
      title: 'Change request: x',
      body: 'body',
    })

    expect(pr).toEqual({ number: 12, html_url: 'https://github.com/x/y/pull/12', created: true })
    const createCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/pulls')
    ) as unknown as [string, RequestInit]
    expect(createCall).toBeTruthy()
    const sentBody = JSON.parse(String(createCall[1].body))
    expect(sentBody.draft).toBe(true)
  })

  it('updating an already-open pull request does not touch draft status either way', async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.includes('/pulls?state=open')) {
        return new Response(
          JSON.stringify([{ number: 12, html_url: 'https://github.com/x/y/pull/12' }]),
          { status: 200 }
        )
      }
      return new Response('{}', { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const gh = configuredGitHub()
    const pr = await gh.openOrUpdatePull({
      branch: 'change-request/abcd1234-x',
      base: 'main',
      title: 'Change request: x (repair)',
      body: 'body',
    })

    expect(pr.created).toBe(false)
    const patchCall = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === 'PATCH'
    ) as unknown as [string, RequestInit]
    expect(patchCall).toBeTruthy()
    const sentBody = JSON.parse(String(patchCall[1].body))
    expect(sentBody).not.toHaveProperty('draft')
  })
})

describe('markDraftForBranch', () => {
  it('re-drafts an existing ready PR before its next revision can be pushed', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/pulls?state=open')) return new Response(JSON.stringify([{ number: 12 }]))
      if (url.includes('/graphql')) {
        const body = JSON.parse(String(init?.body))
        expect(body.query).toContain('convertPullRequestToDraft')
        expect(body.variables).toEqual({ id: 'PR_existing' })
        return new Response(JSON.stringify({ data: {} }))
      }
      return new Response(JSON.stringify({ node_id: 'PR_existing', draft: false }))
    })
    vi.stubGlobal('fetch', fetchMock)
    await configuredGitHub().markDraftForBranch('change-request/example')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does nothing when there is no existing pull request', async () => {
    const fetchMock = vi.fn(async () => new Response('[]'))
    vi.stubGlobal('fetch', fetchMock)
    await configuredGitHub().markDraftForBranch('change-request/new')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('markReadyForReview', () => {
  it('promotes a draft PR via the GraphQL markPullRequestReadyForReview mutation', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes('/graphql')) {
        const parsed = JSON.parse(String(init?.body))
        expect(parsed.query).toContain('markPullRequestReadyForReview')
        expect(parsed.variables).toEqual({ id: 'PR_kwABC' })
        expect((init?.headers as Record<string, string>).Authorization).toBe(
          'Bearer plain-looking-github-token-value-xyz'
        )
        return new Response(
          JSON.stringify({
            data: {
              markPullRequestReadyForReview: { pullRequest: { id: 'PR_kwABC', isDraft: false } },
            },
          }),
          { status: 200 }
        )
      }
      return new Response(JSON.stringify({ node_id: 'PR_kwABC', draft: true }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const gh = configuredGitHub()
    await gh.markReadyForReview(12)

    const graphqlCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/graphql'))
    expect(graphqlCall).toBeTruthy()
  })

  it('is a no-op when the pull request is already not a draft', async () => {
    const fetchMock = vi.fn(
      async (_url: string) =>
        new Response(JSON.stringify({ node_id: 'PR_kwABC', draft: false }), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)

    const gh = configuredGitHub()
    await gh.markReadyForReview(12)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('/graphql')
  })

  it('surfaces GraphQL errors instead of silently leaving the PR in draft', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/graphql')) {
        return new Response(
          JSON.stringify({ errors: [{ message: 'Could not resolve to a PullRequest' }] }),
          { status: 200 }
        )
      }
      return new Response(JSON.stringify({ node_id: 'PR_bad', draft: true }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const gh = configuredGitHub()
    await expect(gh.markReadyForReview(12)).rejects.toThrow(/GraphQL errors/)
  })
})
