import { describe, expect, it } from 'vitest'

import {
  getChangeRequestStatusInfo,
  isActiveChangeRequestStatus,
  normalizeVerificationChecks,
  safeExternalUrl,
  sameOriginUrl,
  shortCommitSha,
} from '@/lib/change-request-status'
import { isValidPagePath } from '@/components/features/ElementPicker'

describe('change request status helpers', () => {
  it('labels every lifecycle status and tolerates unknown values', () => {
    expect(getChangeRequestStatusInfo('queued').label).toBe('Queued')
    expect(getChangeRequestStatusInfo('submitting')).toMatchObject({
      label: 'Submitting…',
      tone: 'neutral',
    })
    expect(getChangeRequestStatusInfo('needs_attention').tone).toBe('warn')
    expect(getChangeRequestStatusInfo('ready_for_review').tone).toBe('ok')
    expect(getChangeRequestStatusInfo('mystery')).toMatchObject({ label: 'mystery' })
  })

  it('treats queued, in_progress, and verifying as live', () => {
    expect(
      ['submitting', 'queued', 'in_progress', 'verifying'].every(isActiveChangeRequestStatus)
    ).toBe(true)
    expect(isActiveChangeRequestStatus('ready_for_review')).toBe(false)
    expect(isActiveChangeRequestStatus('needs_attention')).toBe(false)
  })
})

describe('normalizeVerificationChecks', () => {
  it('accepts arrays of objects with common keys', () => {
    expect(
      normalizeVerificationChecks([
        { name: 'Flyer visible', passed: true, detail: '820px wide' },
        { label: 'Mobile', status: 'fail', notes: 'overflows' },
        { check: 'Console', result: 'maybe' },
      ])
    ).toEqual([
      { name: 'Flyer visible', outcome: 'pass', detail: '820px wide' },
      { name: 'Mobile', outcome: 'fail', detail: 'overflows' },
      { name: 'Console', outcome: 'unknown', detail: null },
    ])
  })

  it('accepts string arrays and objects keyed by check name', () => {
    expect(normalizeVerificationChecks(['Loaded page'])).toEqual([
      { name: 'Loaded page', outcome: 'unknown', detail: null },
    ])
    expect(
      normalizeVerificationChecks({ 'No console errors': true, Layout: 'looks right' })
    ).toEqual([
      { name: 'No console errors', outcome: 'pass', detail: null },
      { name: 'Layout', outcome: 'unknown', detail: 'looks right' },
    ])
  })

  it('ignores missing or malformed checks', () => {
    expect(normalizeVerificationChecks(undefined)).toEqual([])
    expect(normalizeVerificationChecks('nope')).toEqual([])
    expect(normalizeVerificationChecks([null, 3])).toEqual([])
  })
})

describe('safeExternalUrl', () => {
  it('allows only http(s) URLs', () => {
    expect(safeExternalUrl('https://github.com/o/r/pull/1')).toBe('https://github.com/o/r/pull/1')
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull()
    expect(safeExternalUrl('not a url')).toBeNull()
    expect(safeExternalUrl(null)).toBeNull()
  })
})

describe('sameOriginUrl', () => {
  const base = 'https://st-basils-git-x.vercel.app'

  it('resolves site paths on the base origin', () => {
    expect(sameOriginUrl('/', base)).toBe(`${base}/`)
    expect(sameOriginUrl('/giving', base)).toBe(`${base}/giving`)
  })

  it.each(['//evil.example', '//evil.example/giving', '/\\evil.example', 'https://evil.example/'])(
    'refuses %s, which leaves the origin',
    (path) => {
      expect(sameOriginUrl(path, base)).toBeNull()
    }
  )

  it('refuses an invalid base', () => {
    expect(sameOriginUrl('/', 'not a url')).toBeNull()
  })
})

describe('isValidPagePath (element picker iframe src)', () => {
  it.each(['/', '/giving', '/announcements/x'])('allows %s', (path) => {
    expect(isValidPagePath(path)).toBe(true)
  })

  it.each(['//evil.example', '///evil.example', 'giving', 'https://evil.example', ''])(
    'rejects %s',
    (path) => {
      expect(isValidPagePath(path)).toBe(false)
    }
  )
})

describe('shortCommitSha', () => {
  it('shortens hex SHAs and ignores anything else', () => {
    expect(shortCommitSha('0123456789abcdef0123456789abcdef01234567')).toBe('0123456')
    expect(shortCommitSha('abc')).toBeNull()
    expect(shortCommitSha('<script>')).toBeNull()
    expect(shortCommitSha(null)).toBeNull()
  })
})
