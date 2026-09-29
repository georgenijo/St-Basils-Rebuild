import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { info, warn } = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { child: () => ({ info, warn }) } }))

import { triggerChangeRequestAgent } from './change-request-agent'

const REQUEST = '550e8400-e29b-41d4-a716-446655440002'
const TOKEN = 'synthetic-trigger-secret'
const mockFetch = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', mockFetch)
  vi.stubEnv('FAMILY_HOST_AGENT_TRIGGER_TOKEN', TOKEN)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('managed agent wakeup', () => {
  it('preserves polling mode when no trigger is configured', async () => {
    vi.stubEnv('FAMILY_HOST_AGENT_TRIGGER_TOKEN', '')
    expect(await triggerChangeRequestAgent(REQUEST)).toBe('not_configured')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('sends only the request id to the fixed platform origin with a bounded deadline', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    const cancel = vi.fn().mockResolvedValue(undefined)
    mockFetch.mockResolvedValue({ status: 202, body: { cancel } })
    expect(await triggerChangeRequestAgent(REQUEST)).toBe('accepted')
    expect(mockFetch).toHaveBeenCalledExactlyOnceWith(
      'https://family.georgenijo.com/api/automation/agents/run',
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: { request_id: REQUEST } }),
        redirect: 'error',
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      })
    )
    expect(timeout).toHaveBeenCalledWith(8_000)
    expect(cancel).toHaveBeenCalledOnce()
    expect(JSON.stringify(info.mock.calls)).not.toContain(TOKEN)
  })

  it.each([200, 301, 401, 403, 409, 429, 500])(
    'keeps HTTP %s retryable without logging the body',
    async (status) => {
      const text = vi.fn().mockResolvedValue(TOKEN)
      mockFetch.mockResolvedValue({ status, body: { cancel: vi.fn() }, text })
      expect(await triggerChangeRequestAgent(REQUEST)).toBe('unavailable')
      expect(text).not.toHaveBeenCalled()
      expect(warn).toHaveBeenCalledWith('change_request.agent_dispatch_unavailable', {
        requestId: REQUEST,
        status,
      })
      expect(JSON.stringify(warn.mock.calls)).not.toContain(TOKEN)
      expect(mockFetch).toHaveBeenCalledOnce()
    }
  )

  it('does not expose thrown errors or retry ambiguous launches automatically', async () => {
    mockFetch.mockRejectedValue(new Error(`request failed Authorization: ${TOKEN}`))
    expect(await triggerChangeRequestAgent(REQUEST)).toBe('unavailable')
    expect(warn).toHaveBeenCalledWith('change_request.agent_dispatch_unavailable', {
      requestId: REQUEST,
    })
    expect(JSON.stringify(warn.mock.calls)).not.toContain(TOKEN)
    expect(mockFetch).toHaveBeenCalledOnce()
  })
})
