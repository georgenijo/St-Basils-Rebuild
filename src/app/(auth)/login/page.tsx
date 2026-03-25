import Image from 'next/image'

import type { Metadata } from 'next'

import { LoginForm } from '@/components/features/LoginForm'

export const metadata: Metadata = {
  title: 'Login',
  description: 'Sign in to the St. Basil\'s church admin portal.',
}

export default function LoginPage() {
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
          <h1 className="font-heading text-2xl font-semibold text-wood-900">
            Admin Login
          </h1>
        </div>

        <LoginForm />
      </div>
    </main>
  )
}
