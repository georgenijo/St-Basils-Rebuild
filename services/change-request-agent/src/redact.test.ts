import { describe, expect, it } from 'vitest'

import { prTitle, redactPublic } from './redact'

describe('redactPublic', () => {
  it('removes emails and phone numbers', () => {
    expect(redactPublic('Email john.doe+x@mail.example.org today')).toBe('Email [redacted] today')
    expect(redactPublic('Call 617-555-0123, (978) 460 9470 or +1 914.843.7111')).toBe(
      'Call [redacted], [redacted] or [redacted]'
    )
    expect(redactPublic('Intl +44 20 7946 0958.')).toBe('Intl [redacted].')
  })

  it('removes worker secrets and secret-shaped tokens', () => {
    expect(redactPublic('key=my-very-secret-value-123', ['my-very-secret-value-123'])).toBe(
      'key=[redacted]'
    )
    expect(redactPublic('token ghp_abcdefghijklmnopqrstuvwxyz0123456789')).toBe('token [redacted]')
  })

  it('keeps uuids, commit shas, dates, times and ordinary numbers', () => {
    const text =
      'request 2e94195f-7ce6-4574-bb09-598b1c731900 commit 69a941b00b5c2a13f974b8c173ee6e178ee0bdac on 2026-10-03 at 6:30 PM, $50, 800 lines, /admin/requests/12345678-1234-1234-1234-123456789012'
    expect(redactPublic(text)).toBe(text)
  })
})

describe('prTitle', () => {
  it('prefixes, redacts, flattens and truncates to 100 characters', () => {
    expect(prTitle('Fix footer')).toBe('Change request: Fix footer')
    expect(prTitle('Ask jane@example.com\nabout it')).toBe(
      'Change request: Ask [redacted] about it'
    )
    const long = prTitle('x'.repeat(200))
    expect(long.length).toBe(100)
    expect(long.endsWith('…')).toBe(true)
  })
})
