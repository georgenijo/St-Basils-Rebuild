import { describe, it, expect } from 'vitest'
import { announcementSchema } from '@/lib/validators/announcement'

describe('announcementSchema', () => {
  it('passes with valid minimal data and applies defaults', () => {
    const result = announcementSchema.safeParse({
      title: 'Test Announcement',
      slug: 'test-announcement',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.priority).toBe(0)
      expect(result.data.is_pinned).toBe(false)
      expect(result.data.send_email).toBe(false)
      expect(result.data.published).toBe(false)
    }
  })

  it('passes with valid full data', () => {
    const result = announcementSchema.safeParse({
      title: 'Full Announcement',
      slug: 'full-announcement',
      body: 'Some body content here.',
      priority: 5,
      is_pinned: true,
      expires_at: '2026-12-31',
      send_email: true,
      published: true,
    })
    expect(result.success).toBe(true)
  })

  it('fails when title is missing', () => {
    const result = announcementSchema.safeParse({
      title: '',
      slug: 'valid-slug',
    })
    expect(result.success).toBe(false)
  })

  it('fails when title exceeds 200 characters', () => {
    const result = announcementSchema.safeParse({
      title: 'T'.repeat(201),
      slug: 'valid-slug',
    })
    expect(result.success).toBe(false)
  })

  it('fails when slug contains spaces', () => {
    const result = announcementSchema.safeParse({
      title: 'Test',
      slug: 'Has Spaces',
    })
    expect(result.success).toBe(false)
  })

  it('fails when slug contains uppercase letters', () => {
    const result = announcementSchema.safeParse({
      title: 'Test',
      slug: 'UPPERCASE',
    })
    expect(result.success).toBe(false)
  })

  it.each(['hello-world', 'a', 'test-123'])('passes with valid slug "%s"', (slug) => {
    const result = announcementSchema.safeParse({
      title: 'Test',
      slug,
    })
    expect(result.success).toBe(true)
  })

  it('coerces string "5" to number 5 for priority', () => {
    const result = announcementSchema.safeParse({
      title: 'Test',
      slug: 'test',
      priority: '5',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.priority).toBe(5)
    }
  })

  it('fails when priority is below 0', () => {
    const result = announcementSchema.safeParse({
      title: 'Test',
      slug: 'test',
      priority: -1,
    })
    expect(result.success).toBe(false)
  })

  it('fails when priority is above 10', () => {
    const result = announcementSchema.safeParse({
      title: 'Test',
      slug: 'test',
      priority: 11,
    })
    expect(result.success).toBe(false)
  })

  it('coerces boolean values for is_pinned', () => {
    const trueResult = announcementSchema.safeParse({
      title: 'Test',
      slug: 'test',
      is_pinned: true,
    })
    expect(trueResult.success).toBe(true)
    if (trueResult.success) {
      expect(trueResult.data.is_pinned).toBe(true)
    }

    const falseResult = announcementSchema.safeParse({
      title: 'Test',
      slug: 'test',
      is_pinned: false,
    })
    expect(falseResult.success).toBe(true)
    if (falseResult.success) {
      expect(falseResult.data.is_pinned).toBe(false)
    }
  })
})
