import { describe, expect, it } from 'vitest'

import {
  getChangeRequestStatusInfo,
  isActiveChangeRequestStatus,
  normalizeVerificationChecks,
  safeExternalUrl,
} from '@/lib/change-request-status'

describe('change request status helpers', () => {
  it('labels every lifecycle status and tolerates unknown values', () => {
    expect(getChangeRequestStatusInfo('queued').label).toBe('Queued')
    expect(getChangeRequestStatusInfo('needs_attention').tone).toBe('warn')
    expect(getChangeRequestStatusInfo('ready_for_review').tone).toBe('ok')
    expect(getChangeRequestStatusInfo('mystery')).toMatchObject({ label: 'mystery' })
  })

  it('treats queued, in_progress, and verifying as live', () => {
    expect(['queued', 'in_progress', 'verifying'].every(isActiveChangeRequestStatus)).toBe(true)
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
