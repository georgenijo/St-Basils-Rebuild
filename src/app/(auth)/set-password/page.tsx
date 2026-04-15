import { redirect } from 'next/navigation'
import Image from 'next/image'

import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { SetPasswordForm } from '@/components/features/SetPasswordForm'

export const metadata: Metadata = {
  title: 'Set Password',
  description: "Set your password for St. Basil's church portal.",
}

export default async function SetPasswordPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
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
          <h1 className="font-heading text-2xl font-semibold text-wood-900">Set Your Password</h1>
        </div>

        <SetPasswordForm />
      </div>
    </main>
  )
}
