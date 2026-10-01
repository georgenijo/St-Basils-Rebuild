import { describe, expect, it } from 'vitest'

import {
  formatElapsed,
  getChangeRequestStep,
  getChangeRequestStatusInfo,
  isActiveChangeRequestStatus,
  isAwaitingLiveCheck,
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

describe('isAwaitingLiveCheck', () => {
  it('is true for merged requests without an outcome, and briefly after one lands', () => {
    const now = Date.parse('2026-10-01T12:00:00Z')
    const recent = '2026-10-01T11:59:30Z'
    const old = '2026-10-01T11:00:00Z'
    expect(isAwaitingLiveCheck({ status: 'merged', live_check_failed_at: null }, now)).toBe(true)
    expect(isAwaitingLiveCheck({ status: 'merged', live_check_failed_at: recent }, now)).toBe(true)
    expect(isAwaitingLiveCheck({ status: 'merged', live_check_failed_at: old }, now)).toBe(false)
    expect(isAwaitingLiveCheck({ status: 'live', live_at: recent }, now)).toBe(true)
    expect(isAwaitingLiveCheck({ status: 'live', live_at: old }, now)).toBe(false)
    expect(isAwaitingLiveCheck({ status: 'ready_for_review' }, now)).toBe(false)
  })
})

describe('getChangeRequestStep', () => {
  const base = {
    preview_url: null,
    claimed_at: null,
    created_at: '2026-09-30T10:00:00Z',
    updated_at: '2026-09-30T10:05:00Z',
  }
  const claimed = '2026-09-30T10:10:00Z'

  it('waits in the queue since the last status change', () => {
    expect(getChangeRequestStep({ ...base, status: 'queued' })).toEqual({
      key: 'queued',
      label: 'Waiting for the website agent',
      since: base.updated_at,
      startedAt: null,
    })
    expect(getChangeRequestStep({ ...base, status: 'submitting' })).toMatchObject({
      key: 'queued',
      label: 'Saving attachments',
      since: base.created_at,
    })
  })

  it('counts a CI repair round as editing, from when it started', () => {
    expect(
      getChangeRequestStep({
        ...base,
        status: 'in_progress',
        claimed_at: claimed,
        updated_at: '2026-09-30T10:30:00Z',
      })
    ).toMatchObject({ key: 'editing', since: '2026-09-30T10:30:00Z', startedAt: claimed })
  })

  it('is editing from the moment the agent claimed it', () => {
    expect(
      getChangeRequestStep({
        ...base,
        status: 'in_progress',
        claimed_at: claimed,
        updated_at: claimed,
      })
    ).toEqual({ key: 'editing', label: 'Editing the website', since: claimed, startedAt: claimed })
  })

  it('splits verifying into CI/preview and the browser check', () => {
    const verifying = {
      ...base,
      status: 'verifying',
      claimed_at: claimed,
      updated_at: '2026-09-30T10:20:00Z',
    }
    expect(getChangeRequestStep(verifying)).toMatchObject({
      key: 'checks',
      label: 'Waiting for CI checks and the preview site',
      since: '2026-09-30T10:20:00Z',
      startedAt: claimed,
    })
    expect(
      getChangeRequestStep({ ...verifying, preview_url: 'https://preview.vercel.app' })
    ).toMatchObject({ key: 'browser', label: 'Checking the preview in a browser' })
  })

  it.each(['ready_for_review', 'needs_attention', 'merged', 'closed', 'mystery'])(
    'has no live step once %s',
    (status) => {
      expect(getChangeRequestStep({ ...base, status })).toBeNull()
    }
  )
})

describe('formatElapsed', () => {
  it.each([
    [-5_000, 'less than a minute'],
    [59_000, 'less than a minute'],
    [60_000, '1 min'],
    [59 * 60_000, '59 min'],
    [60 * 60_000, '1 hr'],
    [65 * 60_000 + 30_000, '1 hr 5 min'],
  ])('formats %d ms as %s', (ms, text) => {
    expect(formatElapsed(ms)).toBe(text)
  })
})
