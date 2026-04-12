import { describe, it, expect } from 'vitest'
import {
  updateFamilySchema,
  addFamilyMemberSchema,
  removeFamilyMemberSchema,
  buySharesSchema,
  recordDonationSchema,
  assignEventCostsSchema,
  recordPaymentSchema,
} from '@/lib/validators/member'

const validUuid = '550e8400-e29b-41d4-a716-446655440000'

describe('updateFamilySchema', () => {
  it('passes with all fields provided', () => {
    const result = updateFamilySchema.safeParse({
      family_name: 'Thomas Family',
      phone: '617-555-1234',
      address: '73 Ellis Street, Newton, MA 02464',
    })
    expect(result.success).toBe(true)
  })

  it('passes with optional fields omitted', () => {
    const result = updateFamilySchema.safeParse({
      family_name: 'Thomas Family',
    })
    expect(result.success).toBe(true)
  })

  it('fails when family_name is empty', () => {
    const result = updateFamilySchema.safeParse({
      family_name: '',
    })
    expect(result.success).toBe(false)
  })

  it('fails when family_name exceeds 200 characters', () => {
    const result = updateFamilySchema.safeParse({
      family_name: 'A'.repeat(201),
    })
    expect(result.success).toBe(false)
  })

  it('fails when phone exceeds 30 characters', () => {
    const result = updateFamilySchema.safeParse({
      family_name: 'Thomas Family',
      phone: '1'.repeat(31),
    })
    expect(result.success).toBe(false)
  })
})

describe('addFamilyMemberSchema', () => {
  it('passes with valid full_name and relationship', () => {
    const result = addFamilyMemberSchema.safeParse({
      full_name: 'Sarah Thomas',
      relationship: 'spouse',
    })
    expect(result.success).toBe(true)
  })

  it('fails when full_name is empty', () => {
    const result = addFamilyMemberSchema.safeParse({
      full_name: '',
      relationship: 'child',
    })
    expect(result.success).toBe(false)
  })

  it('fails when relationship is invalid', () => {
    const result = addFamilyMemberSchema.safeParse({
      full_name: 'Sarah Thomas',
      relationship: 'cousin',
    })
    expect(result.success).toBe(false)
  })

  it('fails when relationship is missing', () => {
    const result = addFamilyMemberSchema.safeParse({
      full_name: 'Sarah Thomas',
    })
    expect(result.success).toBe(false)
  })
})

describe('removeFamilyMemberSchema', () => {
  it('passes with valid UUID', () => {
    const result = removeFamilyMemberSchema.safeParse({
      member_id: validUuid,
    })
    expect(result.success).toBe(true)
  })

  it('fails when member_id is not a valid UUID', () => {
    const result = removeFamilyMemberSchema.safeParse({
      member_id: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('fails when member_id is missing', () => {
    const result = removeFamilyMemberSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('buySharesSchema', () => {
  it('passes with one person name and year', () => {
    const result = buySharesSchema.safeParse({
      names: ['George Thomas'],
      year: 2026,
    })
    expect(result.success).toBe(true)
  })

  it('passes with multiple person names', () => {
    const result = buySharesSchema.safeParse({
      names: ['George Thomas', 'Mary Thomas', 'Abraham Thomas'],
      year: 2026,
    })
    expect(result.success).toBe(true)
  })

  it('fails with empty names array', () => {
    const result = buySharesSchema.safeParse({
      names: [],
      year: 2026,
    })
    expect(result.success).toBe(false)
  })

  it('fails with empty string in names', () => {
    const result = buySharesSchema.safeParse({
      names: ['George Thomas', ''],
      year: 2026,
    })
    expect(result.success).toBe(false)
  })

  it('fails when year is not an integer', () => {
    const result = buySharesSchema.safeParse({
      names: ['George Thomas'],
      year: 2026.5,
    })
    expect(result.success).toBe(false)
  })
})

describe('recordDonationSchema', () => {
  it('passes with amount and note', () => {
    const result = recordDonationSchema.safeParse({
      amount: 100,
      note: 'Sunday offering',
    })
    expect(result.success).toBe(true)
  })

  it('passes with note omitted', () => {
    const result = recordDonationSchema.safeParse({
      amount: 50,
    })
    expect(result.success).toBe(true)
  })

  it('fails when amount is zero or negative', () => {
    const result = recordDonationSchema.safeParse({
      amount: 0,
    })
    expect(result.success).toBe(false)

    const result2 = recordDonationSchema.safeParse({
      amount: -10,
    })
    expect(result2.success).toBe(false)
  })

  it('fails when amount has more than 2 decimal places', () => {
    const result = recordDonationSchema.safeParse({
      amount: 10.999,
    })
    expect(result.success).toBe(false)
  })
})

describe('assignEventCostsSchema', () => {
  it('passes with one charge', () => {
    const result = assignEventCostsSchema.safeParse({
      event_id: validUuid,
      charges: [{ family_id: validUuid, amount: 25 }],
    })
    expect(result.success).toBe(true)
  })

  it('passes with multiple charges', () => {
    const result = assignEventCostsSchema.safeParse({
      event_id: validUuid,
      charges: [
        { family_id: '550e8400-e29b-41d4-a716-446655440001', amount: 25 },
        { family_id: '550e8400-e29b-41d4-a716-446655440002', amount: 50 },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('fails with empty charges array', () => {
    const result = assignEventCostsSchema.safeParse({
      event_id: validUuid,
      charges: [],
    })
    expect(result.success).toBe(false)
  })

  it('fails with invalid event_id', () => {
    const result = assignEventCostsSchema.safeParse({
      event_id: 'not-a-uuid',
      charges: [{ family_id: validUuid, amount: 25 }],
    })
    expect(result.success).toBe(false)
  })
})

describe('recordPaymentSchema', () => {
  it('passes with all fields', () => {
    const result = recordPaymentSchema.safeParse({
      family_id: validUuid,
      type: 'membership',
      amount: 100,
      method: 'check',
      note: 'Annual membership payment',
    })
    expect(result.success).toBe(true)
  })

  it('passes with note omitted', () => {
    const result = recordPaymentSchema.safeParse({
      family_id: validUuid,
      type: 'donation',
      amount: 50,
      method: 'cash',
    })
    expect(result.success).toBe(true)
  })

  it('fails with invalid family_id', () => {
    const result = recordPaymentSchema.safeParse({
      family_id: 'bad-id',
      type: 'membership',
      amount: 100,
      method: 'cash',
    })
    expect(result.success).toBe(false)
  })

  it('fails with invalid type', () => {
    const result = recordPaymentSchema.safeParse({
      family_id: validUuid,
      type: 'refund',
      amount: 100,
      method: 'cash',
    })
    expect(result.success).toBe(false)
  })

  it('fails with invalid method', () => {
    const result = recordPaymentSchema.safeParse({
      family_id: validUuid,
      type: 'donation',
      amount: 100,
      method: 'bitcoin',
    })
    expect(result.success).toBe(false)
  })

  it('fails with negative amount', () => {
    const result = recordPaymentSchema.safeParse({
      family_id: validUuid,
      type: 'donation',
      amount: -50,
      method: 'cash',
    })
    expect(result.success).toBe(false)
  })
})
