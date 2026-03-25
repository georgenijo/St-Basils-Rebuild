'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginState = {
  success: boolean
  message: string
  errors?: Record<string, string[]>
}

function isValidRedirectTo(url: string): boolean {
  if (!url.startsWith('/') || url.startsWith('//')) return false
  if (url.includes('\\')) return false
  return true
}

export async function login(
  prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    return { success: false, message: 'Invalid email or password' }
  }

  const redirectTo = formData.get('redirectTo') as string | null
  if (redirectTo && isValidRedirectTo(redirectTo)) {
    redirect(redirectTo)
  }

  redirect('/admin/dashboard')
}
