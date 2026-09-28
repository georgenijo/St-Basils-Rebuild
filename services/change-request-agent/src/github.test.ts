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
    await createGitHub(config).comment(343, comment)

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
