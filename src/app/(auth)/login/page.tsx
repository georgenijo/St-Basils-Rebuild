import { redirect } from 'next/navigation'
import Image from 'next/image'

import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { LoginForm } from '@/components/features/LoginForm'

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
  const destination = redirectTo || '/admin/dashboard'

  if (user) {
    redirect(destination)
  }

  // Auto-login bypass for dev/preview environments
  if (process.env.DEV_ADMIN_BYPASS === 'true') {
    const bypassUrl = `/api/auth/dev-bypass?redirectTo=${encodeURIComponent(destination)}`
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
