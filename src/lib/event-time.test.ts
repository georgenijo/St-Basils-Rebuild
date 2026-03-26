import { describe, it, expect } from 'vitest'
import {
  CHURCH_TIME_ZONE,
  formatInChurchTimeZone,
  getChurchTimeZoneName,
  formatIsoForDatetimeLocal,
  parseDatetimeLocalInTimeZone,
  toUtcDateArray,
  toTimeZoneDateArray,
  toRRuleUtcTimestamp,
  buildRecurrenceUntilTimestamp,
  buildRecurrenceUntilIso,
  parseRRuleUntilToDateInput,
} from '@/lib/event-time'

describe('CHURCH_TIME_ZONE', () => {
  it('is America/New_York', () => {
    expect(CHURCH_TIME_ZONE).toBe('America/New_York')
  })
})

describe('formatInChurchTimeZone', () => {
  it('formats a UTC ISO string into church timezone with given options', () => {
    const result = formatInChurchTimeZone('2026-01-15T17:00:00Z', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    // 17:00 UTC = 12:00 PM EST
    expect(result).toBe('12:00 PM')
  })

  it('formats a summer date respecting EDT offset', () => {
    const result = formatInChurchTimeZone('2026-07-15T16:00:00Z', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    // 16:00 UTC = 12:00 PM EDT
    expect(result).toBe('12:00 PM')
  })
})

describe('getChurchTimeZoneName', () => {
  it('returns EST for a winter date', () => {
    expect(getChurchTimeZoneName('2026-01-15T12:00:00Z')).toBe('EST')
  })

  it('returns EDT for a summer date', () => {
    expect(getChurchTimeZoneName('2026-07-15T12:00:00Z')).toBe('EDT')
  })
})

describe('formatIsoForDatetimeLocal', () => {
  it('converts a UTC ISO string to datetime-local in EST', () => {
    // 2026-01-15T17:30:00Z => 12:30 PM EST => 2026-01-15T12:30
    expect(formatIsoForDatetimeLocal('2026-01-15T17:30:00.000Z')).toBe('2026-01-15T12:30')
  })

  it('converts a UTC ISO string to datetime-local in EDT', () => {
    // 2026-07-15T16:30:00Z => 12:30 PM EDT => 2026-07-15T12:30
    expect(formatIsoForDatetimeLocal('2026-07-15T16:30:00.000Z')).toBe('2026-07-15T12:30')
  })

  it('returns empty string for null', () => {
    expect(formatIsoForDatetimeLocal(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(formatIsoForDatetimeLocal(undefined)).toBe('')
  })

  it('returns empty string for empty string', () => {
    expect(formatIsoForDatetimeLocal('')).toBe('')
  })

  it('returns empty string for invalid date string', () => {
    expect(formatIsoForDatetimeLocal('not-a-date')).toBe('')
  })

  it('accepts a custom timezone', () => {
    // 2026-01-15T12:00:00Z in UTC timezone should stay 12:00
    expect(formatIsoForDatetimeLocal('2026-01-15T12:00:00Z', 'UTC')).toBe('2026-01-15T12:00')
  })
})

describe('parseDatetimeLocalInTimeZone', () => {
  it('converts a winter wall-clock time to UTC ISO string', () => {
    // 2026-01-15T12:30 EST => 17:30 UTC
    const result = parseDatetimeLocalInTimeZone('2026-01-15T12:30')
    expect(result).toBe('2026-01-15T17:30:00.000Z')
  })

  it('converts a summer wall-clock time to UTC ISO string', () => {
    // 2026-07-15T12:30 EDT => 16:30 UTC
    const result = parseDatetimeLocalInTimeZone('2026-07-15T12:30')
    expect(result).toBe('2026-07-15T16:30:00.000Z')
  })

  it('returns null for invalid input', () => {
    expect(parseDatetimeLocalInTimeZone('garbage')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseDatetimeLocalInTimeZone('')).toBeNull()
  })

  it('returns null for DST spring-forward gap time', () => {
    // 2026-03-08 at 2:00 AM ET clocks spring forward to 3:00 AM
    // so 2:30 AM ET does not exist
    expect(parseDatetimeLocalInTimeZone('2026-03-08T02:30')).toBeNull()
  })

  it('handles DST fall-back ambiguous time', () => {
    // 2026-11-01 at 1:30 AM ET is ambiguous (could be EDT or EST)
    // The function should still return a valid ISO string (one of the two)
    const result = parseDatetimeLocalInTimeZone('2026-11-01T01:30')
    expect(result).not.toBeNull()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('handles midnight correctly', () => {
    const result = parseDatetimeLocalInTimeZone('2026-01-15T00:00')
    // Midnight EST = 05:00 UTC
    expect(result).toBe('2026-01-15T05:00:00.000Z')
  })

  it('accepts a custom timezone', () => {
    const result = parseDatetimeLocalInTimeZone('2026-06-15T12:00', 'UTC')
    expect(result).toBe('2026-06-15T12:00:00.000Z')
  })
})

describe('round-trip: formatIsoForDatetimeLocal <-> parseDatetimeLocalInTimeZone', () => {
  it('round-trips a winter datetime', () => {
    const input = '2026-01-20T09:45'
    const iso = parseDatetimeLocalInTimeZone(input)
    expect(iso).not.toBeNull()
    expect(formatIsoForDatetimeLocal(iso!)).toBe(input)
  })

  it('round-trips a summer datetime', () => {
    const input = '2026-07-04T18:00'
    const iso = parseDatetimeLocalInTimeZone(input)
    expect(iso).not.toBeNull()
    expect(formatIsoForDatetimeLocal(iso!)).toBe(input)
  })
})

describe('toUtcDateArray', () => {
  it('extracts UTC components as [year, month, day, hour, minute]', () => {
    expect(toUtcDateArray('2026-12-31T05:30:00.000Z')).toEqual([2026, 12, 31, 5, 30])
  })

  it('handles month correctly (1-indexed)', () => {
    expect(toUtcDateArray('2026-01-01T00:00:00.000Z')).toEqual([2026, 1, 1, 0, 0])
  })
})

describe('toTimeZoneDateArray', () => {
  it('converts to church timezone components in winter (EST)', () => {
    // 2026-01-15T17:30:00Z => 12:30 EST
    expect(toTimeZoneDateArray('2026-01-15T17:30:00.000Z')).toEqual([2026, 1, 15, 12, 30])
  })

  it('converts to church timezone components in summer (EDT)', () => {
    // 2026-07-15T16:30:00Z => 12:30 EDT
    expect(toTimeZoneDateArray('2026-07-15T16:30:00.000Z')).toEqual([2026, 7, 15, 12, 30])
  })

  it('accepts a custom timezone', () => {
    expect(toTimeZoneDateArray('2026-01-15T12:00:00.000Z', 'UTC')).toEqual([2026, 1, 15, 12, 0])
  })
})

describe('toRRuleUtcTimestamp', () => {
  it('converts ISO string to RRULE UTC format', () => {
    expect(toRRuleUtcTimestamp('2026-12-31T05:00:00.000Z')).toBe('20261231T050000Z')
  })

  it('handles single-digit months and days', () => {
    expect(toRRuleUtcTimestamp('2026-01-05T09:15:00.000Z')).toBe('20260105T091500Z')
  })
})

describe('buildRecurrenceUntilIso', () => {
  it('combines a date and start time into a UTC ISO string', () => {
    // untilDate 2026-12-31, startsAtLocal 2026-01-15T10:00 => until is 2026-12-31T10:00 ET
    // In winter (Dec 31 is EST): 10:00 EST = 15:00 UTC
    const result = buildRecurrenceUntilIso('2026-12-31', '2026-01-15T10:00')
    expect(result).toBe('2026-12-31T15:00:00.000Z')
  })

  it('returns null for invalid startsAtLocal', () => {
    expect(buildRecurrenceUntilIso('2026-12-31', 'bad-input')).toBeNull()
  })
})

describe('buildRecurrenceUntilTimestamp', () => {
  it('returns RRULE UTC timestamp format', () => {
    const result = buildRecurrenceUntilTimestamp('2026-12-31', '2026-01-15T10:00')
    expect(result).toBe('20261231T150000Z')
  })

  it('returns null for invalid input', () => {
    expect(buildRecurrenceUntilTimestamp('2026-12-31', 'invalid')).toBeNull()
  })
})

describe('parseRRuleUntilToDateInput', () => {
  it('parses RRULE UTC timestamp to date input in church timezone (EST)', () => {
    // 20261231T050000Z => 2026-12-31T00:00 EST => date is 2026-12-31
    expect(parseRRuleUntilToDateInput('20261231T050000Z')).toBe('2026-12-31')
  })

  it('parses RRULE UTC timestamp to date input in church timezone (EDT)', () => {
    // 20260715T040000Z => 2026-07-15T00:00 EDT => date is 2026-07-15
    expect(parseRRuleUntilToDateInput('20260715T040000Z')).toBe('2026-07-15')
  })

  it('handles date rollover due to timezone offset', () => {
    // 20260101T030000Z => 2025-12-31T22:00 EST => date is 2025-12-31
    expect(parseRRuleUntilToDateInput('20260101T030000Z')).toBe('2025-12-31')
  })

  it('falls back to slicing for non-UTC RRULE format', () => {
    expect(parseRRuleUntilToDateInput('20261231T100000')).toBe('2026-12-31')
  })
})
