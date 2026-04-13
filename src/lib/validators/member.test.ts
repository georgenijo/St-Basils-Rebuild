import { describe, it, expect } from 'vitest'
import {
  updateFamilySchema,
  addFamilyMemberSchema,
  removeFamilyMemberSchema,
  buySharesSchema,
  recordDonationSchema,
  assignEventCostsSchema,
  recordPaymentSchema,
  markSharesPaidSchema,
  submitPaymentSchema,
  confirmPaymentSchema,
  rejectPaymentSchema,
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
  it('passes with donation_type, amount, and note', () => {
    const result = recordDonationSchema.safeParse({
      donation_type: 'general',
      amount: 100,
      note: 'Sunday offering',
    })
    expect(result.success).toBe(true)
  })

  it('passes with note omitted', () => {
    const result = recordDonationSchema.safeParse({
      donation_type: 'car_blessing',
      amount: 50,
    })
    expect(result.success).toBe(true)
  })

  it('fails when amount is zero or negative', () => {
    const result = recordDonationSchema.safeParse({
      donation_type: 'general',
      amount: 0,
    })
    expect(result.success).toBe(false)

    const result2 = recordDonationSchema.safeParse({
      donation_type: 'general',
      amount: -10,
    })
    expect(result2.success).toBe(false)
  })

  it('fails when amount has more than 2 decimal places', () => {
    const result = recordDonationSchema.safeParse({
      donation_type: 'general',
      amount: 10.999,
    })
    expect(result.success).toBe(false)
  })

  it('fails when donation_type is missing', () => {
    const result = recordDonationSchema.safeParse({
      amount: 50,
    })
    expect(result.success).toBe(false)
  })

  it('fails when donation_type is invalid', () => {
    const result = recordDonationSchema.safeParse({
      donation_type: 'tithe',
      amount: 50,
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

  // superRefine conditional validation tests
  it('passes event payment with related_event_id', () => {
    const result = recordPaymentSchema.safeParse({
      family_id: validUuid,
      type: 'event',
      amount: 25,
      method: 'cash',
      related_event_id: validUuid,
    })
    expect(result.success).toBe(true)
  })

  it('fails event payment without related_event_id', () => {
    const result = recordPaymentSchema.safeParse({
      family_id: validUuid,
      type: 'event',
      amount: 25,
      method: 'cash',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors
      expect(fields.related_event_id).toBeDefined()
    }
  })

  it('fails event payment with empty string related_event_id', () => {
    const result = recordPaymentSchema.safeParse({
      family_id: validUuid,
      type: 'event',
      amount: 25,
      method: 'cash',
      related_event_id: '',
    })
    expect(result.success).toBe(false)
  })

  it('passes share payment with related_share_id', () => {
    const result = recordPaymentSchema.safeParse({
      family_id: validUuid,
      type: 'share',
      amount: 50,
      method: 'check',
      related_share_id: validUuid,
    })
    expect(result.success).toBe(true)
  })

  it('fails share payment without related_share_id', () => {
    const result = recordPaymentSchema.safeParse({
      family_id: validUuid,
      type: 'share',
      amount: 50,
      method: 'check',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors
      expect(fields.related_share_id).toBeDefined()
    }
  })

  it('fails membership payment with related_event_id set', () => {
    const result = recordPaymentSchema.safeParse({
      family_id: validUuid,
      type: 'membership',
      amount: 100,
      method: 'cash',
      related_event_id: validUuid,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors
      expect(fields.related_event_id).toBeDefined()
    }
  })

  it('fails membership payment with related_share_id set', () => {
    const result = recordPaymentSchema.safeParse({
      family_id: validUuid,
      type: 'membership',
      amount: 100,
      method: 'cash',
      related_share_id: validUuid,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors
      expect(fields.related_share_id).toBeDefined()
    }
  })

  it('passes donation payment with no relation IDs', () => {
    const result = recordPaymentSchema.safeParse({
      family_id: validUuid,
      type: 'donation',
      amount: 50,
      method: 'zelle',
    })
    expect(result.success).toBe(true)
  })

  it('fails donation payment with related_event_id set', () => {
    const result = recordPaymentSchema.safeParse({
      family_id: validUuid,
      type: 'donation',
      amount: 50,
      method: 'cash',
      related_event_id: validUuid,
    })
    expect(result.success).toBe(false)
  })

  it('coerces string amount to number', () => {
    const result = recordPaymentSchema.safeParse({
      family_id: validUuid,
      type: 'donation',
      amount: '100',
      method: 'online',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.amount).toBe(100)
    }
  })
})

describe('markSharesPaidSchema', () => {
  it('passes with one share_id and method', () => {
    const result = markSharesPaidSchema.safeParse({
      share_ids: [validUuid],
      method: 'cash',
    })
    expect(result.success).toBe(true)
  })

  it('passes with multiple share_ids and optional note', () => {
    const result = markSharesPaidSchema.safeParse({
      share_ids: [validUuid, '550e8400-e29b-41d4-a716-446655440001'],
      method: 'check',
      note: 'Paid together',
    })
    expect(result.success).toBe(true)
  })

  it('fails with empty share_ids array', () => {
    const result = markSharesPaidSchema.safeParse({
      share_ids: [],
      method: 'cash',
    })
    expect(result.success).toBe(false)
  })

  it('fails with invalid UUID in share_ids', () => {
    const result = markSharesPaidSchema.safeParse({
      share_ids: ['not-a-uuid'],
      method: 'cash',
    })
    expect(result.success).toBe(false)
  })

  it('fails with invalid method', () => {
    const result = markSharesPaidSchema.safeParse({
      share_ids: [validUuid],
      method: 'bitcoin',
    })
    expect(result.success).toBe(false)
  })

  it('fails without method', () => {
    const result = markSharesPaidSchema.safeParse({
      share_ids: [validUuid],
    })
    expect(result.success).toBe(false)
  })
})

// ─── submitPaymentSchema ────────────────────────────────────────────

describe('submitPaymentSchema', () => {
  it('passes with valid member payment submission', () => {
    const result = submitPaymentSchema.safeParse({
      type: 'membership',
      amount: 100,
      method: 'zelle',
      reference_memo: 'DUES-APR26-NIJO',
    })
    expect(result.success).toBe(true)
  })

  it('passes event payment with related_event_id', () => {
    const result = submitPaymentSchema.safeParse({
      type: 'event',
      amount: 25,
      method: 'venmo',
      reference_memo: 'EVENT-FAMNIGHT-NIJO',
      related_event_id: validUuid,
    })
    expect(result.success).toBe(true)
  })

  it('fails with admin-only method (cash)', () => {
    const result = submitPaymentSchema.safeParse({
      type: 'donation',
      amount: 50,
      method: 'cash',
      reference_memo: 'DONATE-GEN-APR26-NIJO',
    })
    expect(result.success).toBe(false)
  })

  it('fails event payment without related_event_id', () => {
    const result = submitPaymentSchema.safeParse({
      type: 'event',
      amount: 25,
      method: 'cashapp',
      reference_memo: 'EVENT-TEST-NIJO',
    })
    expect(result.success).toBe(false)
  })

  it('fails without reference_memo', () => {
    const result = submitPaymentSchema.safeParse({
      type: 'membership',
      amount: 100,
      method: 'zelle',
    })
    expect(result.success).toBe(false)
  })

  it('accepts cashapp as method', () => {
    const result = submitPaymentSchema.safeParse({
      type: 'donation',
      amount: 50,
      method: 'cashapp',
      reference_memo: 'DONATE-GEN-APR26-TEST',
    })
    expect(result.success).toBe(true)
  })
})

// ─── confirmPaymentSchema ───────────────────────────────────────────

describe('confirmPaymentSchema', () => {
  it('passes with valid UUID', () => {
    const result = confirmPaymentSchema.safeParse({ payment_id: validUuid })
    expect(result.success).toBe(true)
  })

  it('fails with invalid UUID', () => {
    const result = confirmPaymentSchema.safeParse({ payment_id: 'not-uuid' })
    expect(result.success).toBe(false)
  })
})

// ─── rejectPaymentSchema ────────────────────────────────────────────

describe('rejectPaymentSchema', () => {
  it('passes with valid payment_id and reason', () => {
    const result = rejectPaymentSchema.safeParse({
      payment_id: validUuid,
      reason: 'Payment not found in bank records',
    })
    expect(result.success).toBe(true)
  })

  it('fails with empty reason', () => {
    const result = rejectPaymentSchema.safeParse({
      payment_id: validUuid,
      reason: '',
    })
    expect(result.success).toBe(false)
  })

  it('fails without reason', () => {
    const result = rejectPaymentSchema.safeParse({
      payment_id: validUuid,
    })
    expect(result.success).toBe(false)
  })

  it('fails with reason exceeding 500 chars', () => {
    const result = rejectPaymentSchema.safeParse({
      payment_id: validUuid,
      reason: 'x'.repeat(501),
    })
    expect(result.success).toBe(false)
  })
})
