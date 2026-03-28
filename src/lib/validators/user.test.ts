import { describe, it, expect } from 'vitest'
import { inviteUserSchema, updateRoleSchema, userActionSchema } from '@/lib/validators/user'

describe('inviteUserSchema', () => {
  it('passes with valid data', () => {
    const result = inviteUserSchema.safeParse({
      email: 'john@example.com',
      full_name: 'John Doe',
      role: 'member',
    })
    expect(result.success).toBe(true)
  })

  it('passes with admin role', () => {
    const result = inviteUserSchema.safeParse({
      email: 'admin@example.com',
      full_name: 'Admin User',
      role: 'admin',
    })
    expect(result.success).toBe(true)
  })

  it('fails when email is missing', () => {
    const result = inviteUserSchema.safeParse({
      email: '',
      full_name: 'John Doe',
      role: 'member',
    })
    expect(result.success).toBe(false)
  })

  it('fails when email is invalid', () => {
    const result = inviteUserSchema.safeParse({
      email: 'not-an-email',
      full_name: 'John Doe',
      role: 'member',
    })
    expect(result.success).toBe(false)
  })

  it('fails when full_name is missing', () => {
    const result = inviteUserSchema.safeParse({
      email: 'john@example.com',
      full_name: '',
      role: 'member',
    })
    expect(result.success).toBe(false)
  })

  it('fails when full_name exceeds 200 characters', () => {
    const result = inviteUserSchema.safeParse({
      email: 'john@example.com',
      full_name: 'A'.repeat(201),
      role: 'member',
    })
    expect(result.success).toBe(false)
  })

  it('fails when role is invalid', () => {
    const result = inviteUserSchema.safeParse({
      email: 'john@example.com',
      full_name: 'John Doe',
      role: 'superadmin',
    })
    expect(result.success).toBe(false)
  })

  it('fails when role is missing', () => {
    const result = inviteUserSchema.safeParse({
      email: 'john@example.com',
      full_name: 'John Doe',
    })
    expect(result.success).toBe(false)
  })
})

describe('updateRoleSchema', () => {
  it('passes with valid data', () => {
    const result = updateRoleSchema.safeParse({
      user_id: '550e8400-e29b-41d4-a716-446655440000',
      role: 'admin',
    })
    expect(result.success).toBe(true)
  })

  it('fails when user_id is not a valid UUID', () => {
    const result = updateRoleSchema.safeParse({
      user_id: 'not-a-uuid',
      role: 'admin',
    })
    expect(result.success).toBe(false)
  })

  it('fails when user_id is missing', () => {
    const result = updateRoleSchema.safeParse({
      role: 'admin',
    })
    expect(result.success).toBe(false)
  })

  it('fails when role is invalid', () => {
    const result = updateRoleSchema.safeParse({
      user_id: '550e8400-e29b-41d4-a716-446655440000',
      role: 'editor',
    })
    expect(result.success).toBe(false)
  })
})

describe('userActionSchema', () => {
  it('passes with valid UUID', () => {
    const result = userActionSchema.safeParse({
      user_id: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })

  it('fails when user_id is not a valid UUID', () => {
    const result = userActionSchema.safeParse({
      user_id: 'invalid',
    })
    expect(result.success).toBe(false)
  })

  it('fails when user_id is missing', () => {
    const result = userActionSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})
