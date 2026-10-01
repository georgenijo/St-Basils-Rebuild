import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Config } from './config'
import { notify } from './notify'
import type { ChangeRequest } from './types'

const FROM = "St. Basil's Church <noreply@stbasilsboston.org>"

function config(overrides: Partial<Config> = {}): Config {
  return {
    siteUrl: 'https://stbasilsboston.org',
    resendApiKey: 're_test_key',
    notifyEmail: 'george@example.org, office@example.org ,',
    notifyFrom: FROM,
    ...overrides,
  } as Config
}

function request(overrides: Partial<ChangeRequest> = {}): ChangeRequest {
  return {
    id: 'abcd1234-5678-90ab-cdef-1234567890ab',
    requester_id: 'user-1',
    title: 'Replace the <feast> flyer',
    description: 'Use the attached flyer.',
    page_path: '/',
    target_selector: null,
    target_text: null,
    status: 'ready_for_review',
    branch_name: 'change-request/abcd1234-website-update',
    pr_number: 12,
    pr_url: 'https://github.com/georgenijo/St-Basils-Rebuild/pull/12',
    preview_url: 'https://preview.vercel.app',
    verification: { verdict: 'pass', summary: 'Looks right.', checks: [], commit_sha: 'abc' },
    revision_base_sha: null,
    claimed_by: 'w1',
    claimed_at: '2026-09-30T12:00:00Z',
    attempts: 1,
    error: null,
    created_at: '2026-09-30T12:00:00Z',
    updated_at: '2026-09-30T12:00:00Z',
    ...overrides,
  }
}

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(new Response('{"id":"email-1"}', { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function sentBody(): Record<string, unknown> {
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe('https://api.resend.com/emails')
  expect(init.method).toBe('POST')
  expect(init.headers.Authorization).toBe('Bearer re_test_key')
  return JSON.parse(init.body as string)
}

describe('notify', () => {
  it('emails every recipient from the configured sender when a request is ready for review', async () => {
    await notify(config(), {
      request: request(),
      status: 'ready_for_review',
      headline: 'Preview verified (pass): Looks right.',
    })

    const body = sentBody()
    expect(body.from).toBe(FROM)
    expect(body.to).toEqual(['george@example.org', 'office@example.org'])
    expect(body.subject).toBe('Change request ready for review: Replace the <feast> flyer')
    expect(body.text).toContain('Status: ready for review')
    expect(body.text).toContain('Verdict: pass')
    expect(body.text).toContain(
      'Pull request: https://github.com/georgenijo/St-Basils-Rebuild/pull/12'
    )
    expect(body.text).toContain(
      'Admin: https://stbasilsboston.org/admin/requests/abcd1234-5678-90ab-cdef-1234567890ab'
    )
    // Request text is escaped in the HTML part; links stay clickable.
    expect(body.html).toContain('Replace the &lt;feast&gt; flyer')
    expect(body.html).not.toContain('<feast>')
    expect(body.html).toContain(
      '<a href="https://stbasilsboston.org/admin/requests/abcd1234-5678-90ab-cdef-1234567890ab">'
    )
  })

  it('emails when a request needs attention, omitting links it does not have', async () => {
    await notify(config(), {
      request: request({
        status: 'needs_attention',
        pr_number: null,
        pr_url: null,
        preview_url: null,
        verification: null,
      }),
      status: 'needs_attention',
      headline: 'The worker hit an error and stopped: boom',
    })

    const body = sentBody()
    expect(body.subject).toBe('Change request needs attention: Replace the <feast> flyer')
    expect(body.text).toContain('Status: needs attention')
    expect(body.text).toContain('What happened: The worker hit an error and stopped: boom')
    expect(body.text).not.toContain('Pull request:')
    expect(body.text).not.toContain('Preview:')
  })

  it.each([
    ['the Resend key', { resendApiKey: null }],
    ['the recipient list', { notifyEmail: null }],
  ])('only logs when %s is not configured', async (_, overrides) => {
    await notify(config(overrides), {
      request: request(),
      status: 'ready_for_review',
      headline: 'Preview verified',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('never throws when Resend rejects the email or the network fails', async () => {
    fetchMock.mockResolvedValueOnce(new Response('domain not verified', { status: 403 }))
    await expect(
      notify(config(), { request: request(), status: 'needs_attention', headline: 'x' })
    ).resolves.toBeUndefined()

    fetchMock.mockRejectedValueOnce(new Error('network down'))
    await expect(
      notify(config(), { request: request(), status: 'needs_attention', headline: 'x' })
    ).resolves.toBeUndefined()
  })
})
