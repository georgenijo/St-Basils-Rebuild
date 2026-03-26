import { z } from 'zod'

export const announcementSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(200, 'Slug must be 200 characters or less')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers, and hyphens'),
  body: z.string().optional(),
  priority: z.coerce.number().int().min(0).max(10).default(0),
  is_pinned: z.coerce.boolean().default(false),
  expires_at: z.string().optional().or(z.literal('')),
  send_email: z.coerce.boolean().default(false),
  published: z.coerce.boolean().default(false),
})

export type AnnouncementFormData = z.infer<typeof announcementSchema>
