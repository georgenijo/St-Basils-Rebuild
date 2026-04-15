'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { sendUserNotification } from '@/lib/notifications'
import { WelcomeMember } from '@/emails/welcome-member'
import { setPasswordSchema } from '@/lib/validators/user'

type ActionState = {
  success: boolean
  message: string
  errors?: Record<string, string[]>
}

export async function setPassword(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = setPasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })

  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      success: false,
      message: 'Session expired. Please use the link from your email again.',
    }
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })

  if (error) {
    return { success: false, message: 'Failed to set password. Please try again.' }
  }

  revalidatePath('/', 'layout')

  // Redirect based on role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  // Welcome email — only for invite completions, not password recoveries.
  // Use server-trusted signals from the auth user record rather than form data:
  // invited_at is set by Supabase on admin invite; recovery_sent_at is set on
  // password recovery flows. Client cannot mutate either.
  const invitedAt = (user as { invited_at?: string | null }).invited_at ?? null
  const recoverySentAt = (user as { recovery_sent_at?: string | null }).recovery_sent_at ?? null
  const isInviteCompletion = Boolean(invitedAt) && !recoverySentAt
  if (isInviteCompletion) {
    const fullName = profile?.full_name || user.email?.split('@')[0] || 'friend'
    await sendUserNotification(supabase, user.id, 'membership', {
      subject: "Welcome to St. Basil's",
      react: WelcomeMember({ fullName }),
    })
  }

  const destination = profile?.role === 'admin' ? '/admin/dashboard' : '/member'
  redirect(destination)
}
