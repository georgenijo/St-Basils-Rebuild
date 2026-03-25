import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { LoginForm } from '@/components/features/LoginForm'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Login',
}

interface LoginPageProps {
  searchParams: Promise<{ redirectTo?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/admin/dashboard')
  }

  const { redirectTo } = await searchParams

  return (
    <main className="w-full max-w-md px-4 font-body text-wood-800">
      <h1 className="font-heading text-3xl font-semibold text-wood-900">
        Sign In
      </h1>
      <p className="mt-2 text-wood-800/60">
        Sign in to the admin dashboard.
      </p>
      <LoginForm redirectTo={redirectTo} />
    </main>
  )
}
