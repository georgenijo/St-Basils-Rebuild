import type { Metadata } from 'next'
import Link from 'next/link'

import { InviteUserForm } from '@/components/features/InviteUserForm'

export const metadata: Metadata = {
  title: 'Invite User',
}

export default function InviteUserPage() {
  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1 font-body text-sm text-wood-800/60 transition-colors hover:text-burgundy-700"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          Back to Users
        </Link>
        <h1 className="mt-2 font-heading text-3xl font-semibold text-wood-900">Invite User</h1>
      </div>

      <div className="max-w-2xl">
        <InviteUserForm />
      </div>
    </main>
  )
}
