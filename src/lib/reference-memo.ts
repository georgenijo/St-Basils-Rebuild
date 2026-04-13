/**
 * Generates deterministic reference memos for payment matching.
 * Format varies by payment type — see issue #180 for spec.
 */

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

type MemoInput =
  | { type: 'membership'; familyName: string; date: Date }
  | { type: 'share'; familyName: string; personNames: string[]; year: number }
  | { type: 'event'; familyName: string; eventSlug: string }
  | { type: 'donation'; familyName: string; donationType: string; date: Date }

/** Extract the last word of a family name, uppercase, max 10 chars. */
function familySuffix(name: string): string {
  const parts = name.trim().split(/\s+/)
  const last = parts[parts.length - 1] ?? 'UNKNOWN'
  return (
    last
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 10) || 'UNKNOWN'
  )
}

/** First name only, uppercase, stripped of non-alpha. */
function firstName(full: string): string {
  const first = full.trim().split(/\s+/)[0] ?? ''
  return first.toUpperCase().replace(/[^A-Z]/g, '') || 'X'
}

/** Uppercase slug, max 12 chars, only alphanumeric + dash. */
function slugify(text: string): string {
  return (
    text
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, 12) || 'EVENT'
  )
}

export function generateReferenceMemo(input: MemoInput): string {
  const family = familySuffix(input.familyName)

  switch (input.type) {
    case 'membership': {
      const mon = MONTHS[input.date.getMonth()]
      const yy = String(input.date.getFullYear()).slice(-2)
      return `DUES-${mon}${yy}-${family}`
    }
    case 'share': {
      const names = input.personNames.slice(0, 3).map(firstName).join('-')
      return `SHARE-${input.year}-${names}-${family}`
    }
    case 'event': {
      const slug = slugify(input.eventSlug)
      return `EVENT-${slug}-${family}`
    }
    case 'donation': {
      const dtype =
        input.donationType
          .toUpperCase()
          .replace(/[^A-Z]/g, '')
          .slice(0, 6) || 'GEN'
      const mon = MONTHS[input.date.getMonth()]
      const yy = String(input.date.getFullYear()).slice(-2)
      return `DONATE-${dtype}-${mon}${yy}-${family}`
    }
  }
}
