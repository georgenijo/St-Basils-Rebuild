import { z } from 'zod'

const fontFamilyPattern = /^[a-zA-Z0-9 ]+$/

const fontChoiceSchema = z.object({
  family: z
    .string()
    .min(1, 'Font family is required')
    .max(100)
    .regex(fontFamilyPattern, 'Font family contains invalid characters'),
  weights: z
    .array(z.number().int().min(100).max(900))
    .min(1, 'At least one weight is required')
    .max(6),
})

export const themeSettingsSchema = z.object({
  fonts: z.object({
    heading: fontChoiceSchema,
    body: fontChoiceSchema,
    nav: fontChoiceSchema,
  }),
  section_order: z
    .array(z.string().min(1).max(50))
    .min(1, 'At least one section is required')
    .max(20),
})

export type FontChoice = z.infer<typeof fontChoiceSchema>
export type ThemeSettings = z.infer<typeof themeSettingsSchema>
