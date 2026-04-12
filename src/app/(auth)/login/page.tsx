import { redirect } from 'next/navigation'
import Image from 'next/image'

import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { LoginForm } from '@/components/features/LoginForm'
import { isValidRedirectUrl } from '@/lib/validators/redirect'

export const metadata: Metadata = {
  title: 'Login',
  description: "Sign in to the St. Basil's church admin portal.",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { redirectTo } = await searchParams

  if (user) {
    let destination: string
    if (redirectTo && isValidRedirectUrl(redirectTo)) {
      destination = redirectTo
    } else {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profileError || !profile) {
        destination = '/'
      } else {
        destination = profile.role === 'admin' ? '/admin/dashboard' : '/member'
      }
    }
    redirect(destination)
  }

  // Auto-login bypass for dev/preview environments (blocked in production)
  if (
    process.env.DEV_ADMIN_BYPASS === 'true' &&
    process.env.VERCEL_ENV !== 'production' &&
    process.env.DEV_ADMIN_EMAIL &&
    process.env.DEV_ADMIN_PASSWORD
  ) {
    const bypassDestination =
      redirectTo && isValidRedirectUrl(redirectTo) ? redirectTo : '/admin/dashboard'
    const bypassUrl = `/api/auth/dev-bypass?redirectTo=${encodeURIComponent(bypassDestination)}`
    redirect(bypassUrl)
  }

  return (
    <main className="w-full max-w-md px-4">
      <div className="rounded-2xl bg-white p-8 shadow-md sm:p-10">
        <div className="mb-8 flex flex-col items-center gap-4">
          <Image
            src="/logo.png"
            alt="St. Basil's Syriac Orthodox Church"
            width={220}
            height={42}
            priority
          />
          <h1 className="font-heading text-2xl font-semibold text-wood-900">Admin Login</h1>
        </div>

        <LoginForm redirectTo={redirectTo} />
      </div>
    </main>
  )
}
