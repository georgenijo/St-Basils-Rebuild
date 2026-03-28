import { z } from 'zod'

export const inviteUserSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  full_name: z
    .string()
    .min(1, 'Full name is required')
    .max(200, 'Full name must be 200 characters or less'),
  role: z.enum(['admin', 'member'], { message: 'Role must be "admin" or "member"' }),
})

export const updateRoleSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
  role: z.enum(['admin', 'member'], { message: 'Role must be "admin" or "member"' }),
})

export const userActionSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
})

export type InviteUserData = z.infer<typeof inviteUserSchema>
export type UpdateRoleData = z.infer<typeof updateRoleSchema>
export type UserActionData = z.infer<typeof userActionSchema>
