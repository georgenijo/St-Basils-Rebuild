import { describe, it, expect } from 'vitest'
import { contactSchema } from '@/lib/validators/contact'

describe('contactSchema', () => {
  it('passes with valid full submission', () => {
    const result = contactSchema.safeParse({
      name: 'John Doe',
      email: 'john@example.com',
      subject: 'Hello',
      message: 'This is a test message.',
    })
    expect(result.success).toBe(true)
  })

  it('fails when name is missing', () => {
    const result = contactSchema.safeParse({
      name: '',
      email: 'john@example.com',
      subject: 'Hello',
      message: 'Test',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const nameError = result.error.issues.find((i) => i.path[0] === 'name')
      expect(nameError?.message).toBe('Name is required')
    }
  })

  it('fails when name exceeds 100 characters', () => {
    const result = contactSchema.safeParse({
      name: 'A'.repeat(101),
      email: 'john@example.com',
      subject: 'Hello',
      message: 'Test',
    })
    expect(result.success).toBe(false)
  })

  it('fails with an invalid email', () => {
    const result = contactSchema.safeParse({
      name: 'John',
      email: 'not-an-email',
      subject: 'Hello',
      message: 'Test',
    })
    expect(result.success).toBe(false)
  })

  it('fails when email is missing', () => {
    const result = contactSchema.safeParse({
      name: 'John',
      email: '',
      subject: 'Hello',
      message: 'Test',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const emailError = result.error.issues.find((i) => i.path[0] === 'email')
      expect(emailError?.message).toBe('Email is required')
    }
  })

  it('fails when subject exceeds 200 characters', () => {
    const result = contactSchema.safeParse({
      name: 'John',
      email: 'john@example.com',
      subject: 'S'.repeat(201),
      message: 'Test',
    })
    expect(result.success).toBe(false)
  })

  it('fails when message exceeds 5000 characters', () => {
    const result = contactSchema.safeParse({
      name: 'John',
      email: 'john@example.com',
      subject: 'Hello',
      message: 'M'.repeat(5001),
    })
    expect(result.success).toBe(false)
  })

  it('fails when message is empty', () => {
    const result = contactSchema.safeParse({
      name: 'John',
      email: 'john@example.com',
      subject: 'Hello',
      message: '',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msgError = result.error.issues.find((i) => i.path[0] === 'message')
      expect(msgError?.message).toBe('Message is required')
    }
  })
})
