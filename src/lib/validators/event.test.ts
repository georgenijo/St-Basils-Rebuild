import { describe, it, expect } from 'vitest'

import {
  eventSchema,
  eventCategory,
  rruleSchema,
  buildRRuleString,
  parseRRuleString,
  slugify,
} from '@/lib/validators/event'

// ---------------------------------------------------------------------------
// slugify
// ---------------------------------------------------------------------------
describe('slugify', () => {
  it('lowercases and hyphenates words', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('collapses multiple spaces into a single hyphen', () => {
    expect(slugify('  Multiple   Spaces  ')).toBe('multiple-spaces')
  })

  it('strips special characters', () => {
    expect(slugify('Special!@#Chars')).toBe('specialchars')
  })

  it('returns an already-slugified string unchanged', () => {
    expect(slugify('already-slugified')).toBe('already-slugified')
  })

  it('returns empty string for empty input', () => {
    expect(slugify('')).toBe('')
  })

  it('strips leading and trailing hyphens', () => {
    expect(slugify('---leading-trailing---')).toBe('leading-trailing')
  })
})

// ---------------------------------------------------------------------------
// buildRRuleString
// ---------------------------------------------------------------------------
describe('buildRRuleString', () => {
  it('builds a string with frequency only', () => {
    expect(buildRRuleString({ frequency: 'WEEKLY' })).toBe('FREQ=WEEKLY')
  })

  it('includes BYDAY when byDay is provided', () => {
    expect(buildRRuleString({ frequency: 'WEEKLY', byDay: 'SU' })).toBe('FREQ=WEEKLY;BYDAY=SU')
  })

  it('includes UNTIL when until and startsAtLocal are provided', () => {
    const result = buildRRuleString({
      frequency: 'WEEKLY',
      until: '2026-12-31',
      startsAtLocal: '2026-06-01T09:00',
    })
    expect(result).toContain('FREQ=WEEKLY')
    expect(result).toContain('UNTIL=')
  })

  it('includes COUNT when count is provided and until is absent', () => {
    expect(buildRRuleString({ frequency: 'WEEKLY', count: '10' })).toBe('FREQ=WEEKLY;COUNT=10')
  })

  it('until takes priority over count', () => {
    const result = buildRRuleString({
      frequency: 'WEEKLY',
      until: '2026-12-31',
      startsAtLocal: '2026-06-01T09:00',
      count: '10',
    })
    expect(result).toContain('UNTIL=')
    expect(result).not.toContain('COUNT=')
  })
})

// ---------------------------------------------------------------------------
// parseRRuleString
// ---------------------------------------------------------------------------
describe('parseRRuleString', () => {
  it('parses a basic FREQ=WEEKLY string', () => {
    const result = parseRRuleString('FREQ=WEEKLY')
    expect(result.frequency).toBe('WEEKLY')
    expect(result.byDay).toEqual([])
    expect(result.count).toBe('')
  })

  it('parses BYDAY into an array', () => {
    const result = parseRRuleString('FREQ=WEEKLY;BYDAY=SU,MO')
    expect(result.byDay).toEqual(['SU', 'MO'])
  })

  it('parses COUNT', () => {
    const result = parseRRuleString('FREQ=WEEKLY;COUNT=10')
    expect(result.count).toBe('10')
  })

  it('parses UNTIL into a date input string', () => {
    const result = parseRRuleString('FREQ=WEEKLY;UNTIL=20261231T050000Z')
    expect(result.until).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('defaults frequency to WEEKLY when FREQ is missing', () => {
    const result = parseRRuleString('BYDAY=MO')
    expect(result.frequency).toBe('WEEKLY')
  })
})

// ---------------------------------------------------------------------------
// eventSchema
// ---------------------------------------------------------------------------
describe('eventSchema', () => {
  const validData = {
    title: 'Sunday Liturgy',
    slug: 'sunday-liturgy',
    start_at: '2026-06-01T09:00',
    is_recurring: false,
    category: 'liturgical' as const,
  }

  it('accepts valid data', () => {
    const result = eventSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('rejects missing title', () => {
    const result = eventSchema.safeParse({ ...validData, title: '' })
    expect(result.success).toBe(false)
  })

  it('rejects end_at before start_at', () => {
    const result = eventSchema.safeParse({
      ...validData,
      start_at: '2026-06-02T09:00',
      end_at: '2026-06-01T09:00',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('end_at')
    }
  })

  it('rejects is_recurring without rrule_frequency', () => {
    const result = eventSchema.safeParse({
      ...validData,
      is_recurring: true,
      rrule_frequency: '',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('rrule_frequency')
    }
  })

  it('accepts valid slugs', () => {
    for (const slug of ['my-event', 'event-2026', 'a', 'a-b-c']) {
      const result = eventSchema.safeParse({ ...validData, slug })
      expect(result.success).toBe(true)
    }
  })

  it('rejects slug with uppercase letters', () => {
    const result = eventSchema.safeParse({ ...validData, slug: 'Invalid-Slug' })
    expect(result.success).toBe(false)
  })

  it('rejects slug with spaces', () => {
    const result = eventSchema.safeParse({ ...validData, slug: 'has spaces' })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// eventCategory
// ---------------------------------------------------------------------------
describe('eventCategory', () => {
  it('accepts valid categories', () => {
    for (const value of ['liturgical', 'community', 'special']) {
      expect(eventCategory.safeParse(value).success).toBe(true)
    }
  })

  it('rejects an invalid category', () => {
    expect(eventCategory.safeParse('party').success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// rruleSchema
// ---------------------------------------------------------------------------
describe('rruleSchema', () => {
  it('accepts valid data', () => {
    const result = rruleSchema.safeParse({
      frequency: 'WEEKLY',
      byDay: ['SU'],
      count: 10,
    })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid frequency', () => {
    const result = rruleSchema.safeParse({ frequency: 'BIWEEKLY' })
    expect(result.success).toBe(false)
  })
})
