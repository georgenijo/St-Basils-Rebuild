import { describe, it, expect } from 'vitest'
import { generateReferenceMemo } from '@/lib/reference-memo'

describe('generateReferenceMemo', () => {
  // ─── Membership ─────────────────────────────────────────────────────

  describe('membership', () => {
    it('generates DUES-MONYY-FAMILY format', () => {
      const result = generateReferenceMemo({
        type: 'membership',
        familyName: 'George Nijo',
        date: new Date(2026, 3, 1), // April 2026
      })
      expect(result).toBe('DUES-APR26-NIJO')
    })

    it('handles single-word family name', () => {
      const result = generateReferenceMemo({
        type: 'membership',
        familyName: 'Thomas',
        date: new Date(2026, 0, 15), // January
      })
      expect(result).toBe('DUES-JAN26-THOMAS')
    })

    it('truncates long family names to 10 chars', () => {
      const result = generateReferenceMemo({
        type: 'membership',
        familyName: 'Tharuvathattil',
        date: new Date(2026, 11, 1), // December
      })
      expect(result).toBe('DUES-DEC26-THARUVATHA')
    })
  })

  // ─── Share ──────────────────────────────────────────────────────────

  describe('share', () => {
    it('generates SHARE-YEAR-NAMES-FAMILY format', () => {
      const result = generateReferenceMemo({
        type: 'share',
        familyName: 'Mary Mathew',
        personNames: ['Mary', 'Joseph'],
        year: 2026,
      })
      expect(result).toBe('SHARE-2026-MARY-JOSEPH-MATHEW')
    })

    it('limits to 3 names', () => {
      const result = generateReferenceMemo({
        type: 'share',
        familyName: 'Thomas',
        personNames: ['Alice', 'Bob', 'Carol', 'Dave'],
        year: 2026,
      })
      expect(result).toBe('SHARE-2026-ALICE-BOB-CAROL-THOMAS')
    })

    it('uses first name only for each person', () => {
      const result = generateReferenceMemo({
        type: 'share',
        familyName: 'Varghese',
        personNames: ['Mary Ann Thomas'],
        year: 2026,
      })
      expect(result).toBe('SHARE-2026-MARY-VARGHESE')
    })
  })

  // ─── Event ──────────────────────────────────────────────────────────

  describe('event', () => {
    it('generates EVENT-SLUG-FAMILY format', () => {
      const result = generateReferenceMemo({
        type: 'event',
        familyName: 'John Thomas',
        eventSlug: 'family-night',
      })
      expect(result).toBe('EVENT-FAMILY-NIGHT-THOMAS')
    })

    it('strips special characters from slug', () => {
      const result = generateReferenceMemo({
        type: 'event',
        familyName: 'Nijo',
        eventSlug: "St. Mary's Feast!",
      })
      expect(result).toBe('EVENT-STMARYSFEAST-NIJO')
    })

    it('truncates long slugs to 12 chars', () => {
      const result = generateReferenceMemo({
        type: 'event',
        familyName: 'Kumar',
        eventSlug: 'christmas-caroling-2026',
      })
      expect(result).toBe('EVENT-CHRISTMAS-CA-KUMAR')
    })
  })

  // ─── Donation ───────────────────────────────────────────────────────

  describe('donation', () => {
    it('generates DONATE-TYPE-MONYY-FAMILY format', () => {
      const result = generateReferenceMemo({
        type: 'donation',
        familyName: 'Varghese',
        donationType: 'general',
        date: new Date(2026, 3, 1),
      })
      expect(result).toBe('DONATE-GENERA-APR26-VARGHESE')
    })

    it('handles short donation types', () => {
      const result = generateReferenceMemo({
        type: 'donation',
        familyName: 'Thomas',
        donationType: 'car',
        date: new Date(2026, 6, 15),
      })
      expect(result).toBe('DONATE-CAR-JUL26-THOMAS')
    })
  })

  // ─── Edge cases ─────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles family name with special characters', () => {
      const result = generateReferenceMemo({
        type: 'membership',
        familyName: "O'Brien-Smith",
        date: new Date(2026, 5, 1),
      })
      expect(result).toBe('DUES-JUN26-OBRIENSMIT')
    })

    it('handles empty person names in share', () => {
      const result = generateReferenceMemo({
        type: 'share',
        familyName: 'Thomas',
        personNames: [],
        year: 2026,
      })
      expect(result).toBe('SHARE-2026--THOMAS')
    })
  })
})
