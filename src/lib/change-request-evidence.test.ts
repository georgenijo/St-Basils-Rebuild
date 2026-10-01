import { describe, expect, it } from 'vitest'

import { groupEvidenceShots, viewportLabel } from './change-request-evidence'
import type { ChangeRequestFileWithUrl } from '@/types/change-request'

function shot(id: string, label: string | null): ChangeRequestFileWithUrl {
  return {
    id,
    request_id: 'r',
    kind: 'verification',
    storage_path: `requests/r/verification/${id}.png`,
    filename: `${id}.png`,
    content_type: 'image/png',
    size_bytes: 1,
    label,
    created_at: '2026-09-30T12:00:00Z',
    url: `https://signed/${id}`,
  }
}

describe('groupEvidenceShots', () => {
  it('pairs before/after per viewport with desktop first', () => {
    const groups = groupEvidenceShots([
      shot('am', 'after · mobile'),
      shot('bd', 'before · desktop'),
      shot('bm', 'before · mobile'),
      shot('ad', 'after · desktop'),
    ])
    expect(
      groups.comparisons.map((c) => [c.viewport, c.before?.id ?? null, c.after?.id ?? null])
    ).toEqual([
      ['desktop', 'bd', 'ad'],
      ['mobile', 'bm', 'am'],
    ])
    expect(groups.others).toEqual([])
  })

  it('keeps unpaired halves and puts unknown labels and duplicates in others', () => {
    const groups = groupEvidenceShots([
      shot('ad', 'after · desktop'),
      shot('x', 'Home page'),
      shot('n', null),
      shot('ad2', 'after · desktop'),
      shot('at', 'After · Tablet'),
    ])
    expect(
      groups.comparisons.map((c) => [c.viewport, c.before?.id ?? null, c.after?.id ?? null])
    ).toEqual([
      ['desktop', null, 'ad'],
      ['tablet', null, 'at'],
    ])
    expect(groups.others.map((s) => s.id)).toEqual(['x', 'n', 'ad2'])
  })
})

describe('viewportLabel', () => {
  it('capitalises the viewport name', () => {
    expect(viewportLabel('mobile')).toBe('Mobile')
  })
})
