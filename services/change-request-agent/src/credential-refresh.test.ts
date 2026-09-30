import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  parseCredentialResponse,
  refreshGithubCredential,
  startCredentialRefresh,
} from './credential-refresh'
import { redact, registerRedactions } from './log'

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-29T10:00:00Z'))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  registerRedactions([])
})

const OK_BODY = {
  token: 'fresh-token-value-123',
  repository: 'georgenijo/St-Basils-Rebuild',
  expires_at: '2026-09-29T12:00:00Z',
}

describe('parseCredentialResponse', () => {
  it('extracts {token, repository, expiresAt} from the response body', () => {
    expect(parseCredentialResponse(OK_BODY)).toEqual({
      token: 'fresh-token-value-123',
      repository: 'georgenijo/St-Basils-Rebuild',
      expiresAt: '2026-09-29T12:00:00Z',
    })
  })

  it('trims whitespace', () => {
    expect(
      parseCredentialResponse({
        token: '  fresh-token-value-123  ',
        repository: ' georgenijo/St-Basils-Rebuild ',
        expires_at: ' 2026-09-29T12:00:00Z ',
      })
    ).toEqual({
      token: 'fresh-token-value-123',
      repository: 'georgenijo/St-Basils-Rebuild',
      expiresAt: '2026-09-29T12:00:00Z',
    })
  })

  it('rejects malformed, expired, and exactly-expiring credentials', () => {
    for (const expires_at of ['not-a-date', '2026-09-29T09:59:59Z', '2026-09-29T10:00:00Z']) {
      expect(() => parseCredentialResponse({ ...OK_BODY, expires_at })).toThrow()
    }
  })

  it('throws when the body has no usable token/repository/expires_at', () => {
    expect(() => parseCredentialResponse({})).toThrow()
    expect(() =>
      parseCredentialResponse({ token: 'short', repository: 'a/b', expires_at: 'x' })
    ).toThrow()
    expect(() => parseCredentialResponse({ ...OK_BODY, repository: '' })).toThrow()
    expect(() => parseCredentialResponse({ ...OK_BODY, expires_at: undefined })).toThrow()
    // The old (wrong) shape from before the wire contract was confirmed against the broker.
    expect(() => parseCredentialResponse({ GITHUB_TOKEN: 'fresh-token-value-123' })).toThrow()
    expect(() => parseCredentialResponse(null)).toThrow()
    expect(() => parseCredentialResponse('nope')).toThrow()
  })
})

describe('refreshGithubCredential', () => {
  it('POSTs with a bearer run-credential, no body, and returns the parsed credential', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(OK_BODY), { status: 200 }))
    const credential = await refreshGithubCredential(
      'https://family.example.test/api/agent-credentials/github',
      'fhrc_run-credential-abc',
      fetchMock as unknown as typeof fetch
    )
    expect(credential).toEqual({
      token: 'fresh-token-value-123',
      repository: 'georgenijo/St-Basils-Rebuild',
      expiresAt: '2026-09-29T12:00:00Z',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://family.example.test/api/agent-credentials/github')
    expect(init.method).toBe('POST')
    expect(init.redirect).toBe('error')
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer fhrc_run-credential-abc'
    )
    // The broker's handler reads only the bearer token for this route; no body is sent.
    expect(init.body).toBeUndefined()
  })

  it('throws on a non-2xx response without leaking into a resolved credential', async () => {
    const fetchMock = vi.fn(async () => new Response('nope', { status: 500 }))
    await expect(
      refreshGithubCredential(
        'https://family.example.test/api/agent-credentials/github',
        'fhrc_run-credential-abc',
        fetchMock as unknown as typeof fetch
      )
    ).rejects.toThrow()
  })
})

describe('startCredentialRefresh', () => {
  function fakeTimers() {
    let nextId = 1
    const pending = new Map<number, () => void>()
    const setTimeoutImpl = vi.fn((fn: () => void) => {
      const id = nextId++
      pending.set(id, fn)
      return id as unknown as ReturnType<typeof setTimeout>
    })
    const clearTimeoutImpl = vi.fn((id: unknown) => {
      pending.delete(id as number)
    })
    return {
      setTimeoutImpl: setTimeoutImpl as unknown as typeof setTimeout,
      clearTimeoutImpl: clearTimeoutImpl as unknown as typeof clearTimeout,
      async fireNext() {
        const [id, fn] = [...pending.entries()][0]
        pending.delete(id)
        await fn()
      },
      pendingCount() {
        return pending.size
      },
    }
  }

  function jsonResponse(body: unknown): Response {
    return new Response(JSON.stringify(body), { status: 200 })
  }

  it('refreshes on each tick, redacts the new token, and keeps the old one redacted', async () => {
    const timers = fakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ...OK_BODY, token: 'token-one-value-789' }))
      .mockResolvedValueOnce(jsonResponse({ ...OK_BODY, token: 'token-two-value-789' }))
    registerRedactions(['token-one-value-789'])
    const onRefreshed = vi.fn()

    const handle = startCredentialRefresh(
      {
        url: 'https://broker.example/refresh',
        runCredential: 'run-credential-abc',
        intervalMs: 1000,
        expectedRepository: 'georgenijo/St-Basils-Rebuild',
        onRefreshed,
      },
      { fetchImpl: fetchMock as unknown as typeof fetch, ...timers }
    )

    await timers.fireNext()
    expect(onRefreshed).toHaveBeenCalledWith(
      'token-one-value-789',
      expect.objectContaining({ token: 'token-one-value-789' })
    )
    expect(redact('token-one-value-789')).toBe('[redacted]')

    await timers.fireNext()
    expect(onRefreshed).toHaveBeenCalledWith(
      'token-two-value-789',
      expect.objectContaining({ token: 'token-two-value-789' })
    )
    // The previous token stays redacted alongside the new one.
    expect(redact('token-one-value-789')).toBe('[redacted]')
    expect(redact('token-two-value-789')).toBe('[redacted]')

    handle.stop()
  })

  it('keeps the previous token in effect and reschedules when a refresh fails', async () => {
    const timers = fakeTimers()
    const fetchMock = vi.fn(async () => new Response('nope', { status: 500 }))
    const onRefreshed = vi.fn()
    const onError = vi.fn()

    startCredentialRefresh(
      {
        url: 'https://broker.example/refresh',
        runCredential: 'run-credential-abc',
        intervalMs: 1000,
        onRefreshed,
        onError,
      },
      { fetchImpl: fetchMock as unknown as typeof fetch, ...timers }
    )

    await timers.fireNext()
    expect(onRefreshed).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledTimes(1)
    // Failure still reschedules the next attempt.
    expect(timers.pendingCount()).toBe(1)
  })

  it('rejects a refresh scoped to a different repository instead of installing it', async () => {
    const timers = fakeTimers()
    const fetchMock = vi.fn(async () =>
      jsonResponse({ ...OK_BODY, repository: 'someone-else/other-repo' })
    )
    const onRefreshed = vi.fn()
    const onError = vi.fn()

    startCredentialRefresh(
      {
        url: 'https://broker.example/refresh',
        runCredential: 'run-credential-abc',
        intervalMs: 1000,
        expectedRepository: 'georgenijo/St-Basils-Rebuild',
        onRefreshed,
        onError,
      },
      { fetchImpl: fetchMock as unknown as typeof fetch, ...timers }
    )

    await timers.fireNext()
    expect(onRefreshed).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(String((onError.mock.calls[0] as unknown[])[0])).toContain('someone-else/other-repo')
    // A rejected mismatch must never redact/leak the foreign-repo token as if it were live.
    expect(redact('fresh-token-value-123')).not.toBe('[redacted]')
  })

  it('does not install an in-flight credential after stop', async () => {
    const timers = fakeTimers()
    let resolveFetch!: (response: Response) => void
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        })
    )
    const onRefreshed = vi.fn()
    const handle = startCredentialRefresh(
      {
        url: 'https://broker.example/refresh',
        runCredential: 'synthetic-run-credential',
        intervalMs: 1000,
        onRefreshed,
      },
      { fetchImpl: fetchMock as typeof fetch, ...timers }
    )
    const inFlight = timers.fireNext()
    handle.stop()
    resolveFetch(jsonResponse(OK_BODY))
    await inFlight
    expect(onRefreshed).not.toHaveBeenCalled()
    expect(timers.pendingCount()).toBe(0)
  })

  it('stop() prevents any further scheduled refresh', async () => {
    const timers = fakeTimers()
    const fetchMock = vi.fn(async () => jsonResponse(OK_BODY))
    const handle = startCredentialRefresh(
      {
        url: 'https://broker.example/refresh',
        runCredential: 'run-credential-abc',
        intervalMs: 1000,
        onRefreshed: vi.fn(),
      },
      { fetchImpl: fetchMock as unknown as typeof fetch, ...timers }
    )

    handle.stop()
    expect(timers.pendingCount()).toBe(0)
  })
})
