import { z } from 'zod'

export const inviteUserSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  full_name: z
    .string()
    .min(1, 'Full name is required')
    .max(200, 'Full name must be 200 characters or less'),
  role: z.enum(['admin', 'member'], { message: 'Role must be "admin" or "member"' }),
  newsletter_opt_in: z
    .union([z.literal('on'), z.literal('true'), z.literal(''), z.null(), z.undefined()])
    .optional()
    .transform((v) => v === 'on' || v === 'true'),
})

export const updateRoleSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
  role: z.enum(['admin', 'member'], { message: 'Role must be "admin" or "member"' }),
})

export const userActionSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
})

export const setPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(72, 'Password must be 72 characters or less'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type InviteUserData = z.infer<typeof inviteUserSchema>
export type UpdateRoleData = z.infer<typeof updateRoleSchema>
export type UserActionData = z.infer<typeof userActionSchema>
export type SetPasswordData = z.infer<typeof setPasswordSchema>
