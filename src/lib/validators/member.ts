import { z } from 'zod'

export const updateFamilySchema = z.object({
  family_name: z
    .string()
    .min(1, 'Family name is required')
    .max(200, 'Family name must be 200 characters or less'),
  phone: z.string().max(30, 'Phone must be 30 characters or less').optional().or(z.literal('')),
  address: z
    .string()
    .max(500, 'Address must be 500 characters or less')
    .optional()
    .or(z.literal('')),
})

export const addFamilyMemberSchema = z.object({
  full_name: z
    .string()
    .min(1, 'Full name is required')
    .max(200, 'Full name must be 200 characters or less'),
  relationship: z.enum(['self', 'spouse', 'child', 'parent', 'sibling', 'other'], {
    message: 'Relationship must be one of: self, spouse, child, parent, sibling, other',
  }),
})

export const removeFamilyMemberSchema = z.object({
  member_id: z.string().uuid('Invalid member ID'),
})

export const buySharesSchema = z.object({
  names: z
    .array(
      z
        .string()
        .trim()
        .min(1, 'Person name is required')
        .max(200, 'Person name must be 200 characters or less')
    )
    .min(1, 'At least one person name is required'),
  year: z.coerce
    .number()
    .int('Year must be a whole number')
    .min(2000, 'Year must be 2000 or later')
    .max(2100, 'Year must be 2100 or earlier'),
})

export const recordDonationSchema = z.object({
  amount: z.coerce
    .number()
    .positive('Amount must be greater than zero')
    .max(9999999.99, 'Amount exceeds maximum')
    .multipleOf(0.01, 'Amount cannot have more than 2 decimal places'),
  note: z.string().max(500, 'Note must be 500 characters or less').optional().or(z.literal('')),
})

export const assignEventCostsSchema = z.object({
  event_id: z.string().uuid('Invalid event ID'),
  charges: z
    .array(
      z.object({
        family_id: z.string().uuid('Invalid family ID'),
        amount: z.coerce
          .number()
          .positive('Amount must be greater than zero')
          .max(9999999.99, 'Amount exceeds maximum')
          .multipleOf(0.01, 'Amount cannot have more than 2 decimal places'),
      })
    )
    .min(1, 'At least one family charge is required'),
})

export const recordPaymentSchema = z.object({
  family_id: z.string().uuid('Invalid family ID'),
  type: z.enum(['membership', 'share', 'event', 'donation'], {
    message: 'Payment type must be one of: membership, share, event, donation',
  }),
  amount: z.coerce
    .number()
    .positive('Amount must be greater than zero')
    .max(9999999.99, 'Amount exceeds maximum')
    .multipleOf(0.01, 'Amount cannot have more than 2 decimal places'),
  method: z.enum(['cash', 'check', 'zelle', 'online'], {
    message: 'Payment method must be one of: cash, check, zelle, online',
  }),
  note: z.string().max(500, 'Note must be 500 characters or less').optional().or(z.literal('')),
})

export type UpdateFamilyData = z.infer<typeof updateFamilySchema>
export type AddFamilyMemberData = z.infer<typeof addFamilyMemberSchema>
export type RemoveFamilyMemberData = z.infer<typeof removeFamilyMemberSchema>
export type BuySharesData = z.infer<typeof buySharesSchema>
export type RecordDonationData = z.infer<typeof recordDonationSchema>
export type AssignEventCostsData = z.infer<typeof assignEventCostsSchema>
export type RecordPaymentData = z.infer<typeof recordPaymentSchema>
