import { describe, it, expect } from 'vitest'

import { describeRecurrence } from '@/lib/recurrence'

describe('describeRecurrence', () => {
  it('returns "Every day" for FREQ=DAILY', () => {
    expect(describeRecurrence('FREQ=DAILY')).toBe('Every day')
  })

  it('returns "Every week" for FREQ=WEEKLY', () => {
    expect(describeRecurrence('FREQ=WEEKLY')).toBe('Every week')
  })

  it('returns "Every month" for FREQ=MONTHLY', () => {
    expect(describeRecurrence('FREQ=MONTHLY')).toBe('Every month')
  })

  it('returns "Every year" for FREQ=YEARLY', () => {
    expect(describeRecurrence('FREQ=YEARLY')).toBe('Every year')
  })

  it('includes a single day name', () => {
    expect(describeRecurrence('FREQ=WEEKLY;BYDAY=SU')).toBe('Every week on Sunday')
  })

  it('joins three days with commas and "and"', () => {
    expect(describeRecurrence('FREQ=WEEKLY;BYDAY=MO,WE,FR')).toBe(
      'Every week on Monday, Wednesday, and Friday'
    )
  })

  it('joins two days with "and"', () => {
    expect(describeRecurrence('FREQ=WEEKLY;BYDAY=MO,FR')).toBe('Every week on Monday and Friday')
  })

  it('appends plural "times" for count > 1', () => {
    expect(describeRecurrence('FREQ=WEEKLY;COUNT=10')).toBe('Every week, 10 times')
  })

  it('appends singular "time" for count = 1', () => {
    expect(describeRecurrence('FREQ=WEEKLY;COUNT=1')).toBe('Every week, 1 time')
  })

  it('formats an UNTIL date', () => {
    const result = describeRecurrence('FREQ=WEEKLY;BYDAY=SU;UNTIL=20261231T050000Z')
    expect(result).toMatch(/^Every week on Sunday, until December \d{1,2}, 2026$/)
  })

  it('returns empty string when FREQ is missing', () => {
    expect(describeRecurrence('')).toBe('')
  })

  it('returns empty string for a string with no FREQ key', () => {
    expect(describeRecurrence('BYDAY=SU')).toBe('')
  })
})
