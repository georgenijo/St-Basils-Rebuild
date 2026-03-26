import { describe, it, expect } from 'vitest'
import { newsletterSchema } from '@/lib/validators/newsletter'

describe('newsletterSchema', () => {
  it('passes with a valid email', () => {
    const result = newsletterSchema.safeParse({ email: 'user@example.com' })
    expect(result.success).toBe(true)
  })

  it('fails with empty string and returns "Email is required"', () => {
    const result = newsletterSchema.safeParse({ email: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const emailError = result.error.issues.find((i) => i.path[0] === 'email')
      expect(emailError?.message).toBe('Email is required')
    }
  })

  it('fails with an invalid email format', () => {
    const result = newsletterSchema.safeParse({ email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('fails when email field is missing entirely', () => {
    const result = newsletterSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('passes with a complex valid email', () => {
    const result = newsletterSchema.safeParse({
      email: 'user+tag@sub.domain.com',
    })
    expect(result.success).toBe(true)
  })
})
