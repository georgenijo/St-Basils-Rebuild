import { z } from 'zod'

export const rsvpSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  headcount: z.coerce.number().int().min(1, 'At least 1 person required').max(20, 'Maximum 20'),
  children_count: z.coerce.number().int().min(0).max(50).nullable().optional(),
  dietary: z.string().max(500, 'Dietary notes must be 500 characters or less').nullable().optional(),
  bringing: z
    .string()
    .max(500, 'Bringing notes must be 500 characters or less')
    .nullable()
    .optional(),
  notes: z.string().max(1000, 'Notes must be 1,000 characters or less').nullable().optional(),
})

export type RsvpFormData = z.infer<typeof rsvpSchema>

export const rsvpSettingsSchema = z.object({
  enabled: z.boolean(),
  dietary: z.boolean().optional(),
  children_count: z.boolean().optional(),
  bringing: z.boolean().optional(),
  notes: z.boolean().optional(),
})

export type RsvpSettings = z.infer<typeof rsvpSettingsSchema>
