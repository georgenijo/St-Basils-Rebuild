import type { Metadata } from 'next'
import Link from 'next/link'

import { createClient } from '@/lib/supabase/server'
import { UsersPageClient } from './UsersPageClient'

export const metadata: Metadata = {
  title: 'Users',
}

export default async function UsersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, is_active, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch profiles:', error)
    return (
      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="font-heading text-3xl font-semibold text-wood-900">Users</h1>
        <p className="mt-4 font-body text-sm text-red-600">
          Failed to load users. Please try refreshing the page.
        </p>
      </main>
    )
  }

  const all = profiles ?? []
  const adminCount = all.filter((p) => p.role === 'admin').length
  const memberCount = all.filter((p) => p.role === 'member' && p.is_active).length
  const deactivatedCount = all.filter((p) => !p.is_active).length

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-wood-900">Users</h1>
          <p className="mt-1 font-body text-sm text-wood-800/60">
            Manage admin accounts and church members.
          </p>
        </div>
        <Link
          href="/admin/users/invite"
          className="inline-flex items-center gap-2 rounded-lg bg-burgundy-700 px-4 py-2 font-body text-sm font-medium text-cream-50 transition-colors hover:bg-burgundy-800"
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
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Invite User
        </Link>
      </div>

      {/* Summary cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        <SummaryCard label="Total" count={all.length} />
        <SummaryCard label="Admins" count={adminCount} accent="blue" />
        <SummaryCard label="Members" count={memberCount} accent="green" />
        <SummaryCard label="Deactivated" count={deactivatedCount} accent="red" />
      </div>

      <UsersPageClient users={all} currentUserId={user?.id ?? ''} />
    </main>
  )
}

// ─── Summary Card ─────────────────────────────────────────────────

function SummaryCard({
  label,
  count,
  accent,
}: {
  label: string
  count: number
  accent?: 'blue' | 'green' | 'red'
}) {
  const dotColor =
    accent === 'blue'
      ? 'bg-blue-500'
      : accent === 'green'
        ? 'bg-emerald-500'
        : accent === 'red'
          ? 'bg-red-500'
          : 'bg-burgundy-700'

  return (
    <div className="rounded-2xl border border-wood-800/10 bg-cream-50 p-5">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dotColor}`} aria-hidden="true" />
        <span className="font-body text-sm font-medium text-wood-800/60">{label}</span>
      </div>
      <p className="mt-2 font-heading text-3xl font-semibold text-wood-900">{count}</p>
    </div>
  )
}
