'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { isValidRedirectUrl } from '@/lib/validators/redirect'

type LoginState = {
  success: boolean
  message: string
  errors?: Record<string, string[]>
}

export async function login(prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const redirectTo = formData.get('redirectTo') as string | null

  const errors: Record<string, string[]> = {}

  if (!email) {
    errors.email = ['Email is required']
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = ['Please enter a valid email address']
  }

  if (!password) {
    errors.password = ['Password is required']
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, message: 'Validation failed', errors }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { success: false, message: 'Invalid email or password' }
  }

  revalidatePath('/', 'layout')

  let destination: string
  if (redirectTo && isValidRedirectUrl(redirectTo)) {
    destination = redirectTo
  } else {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    destination = profile?.role === 'admin' ? '/admin/dashboard' : '/member'
  }

  redirect(destination)
}
