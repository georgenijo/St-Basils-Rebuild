import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { SubscribersTable } from '@/components/features/SubscribersTable'

export const metadata: Metadata = {
  title: 'Subscribers',
}

export default async function SubscribersPage() {
  const supabase = await createClient()

  const { data: subscribers } = await supabase
    .from('email_subscribers')
    .select('id, email, confirmed, confirmed_at, created_at')
    .order('created_at', { ascending: false })

  const all = subscribers ?? []
  const activeCount = all.filter((s) => s.confirmed).length
  const unconfirmedCount = all.filter((s) => !s.confirmed && s.confirmed_at === null).length

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-semibold text-wood-900">
          Subscribers
        </h1>
        <p className="mt-1 font-body text-sm text-wood-800/60">
          View and manage newsletter subscribers.
        </p>
      </div>

      {/* Summary cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Total" count={all.length} />
        <SummaryCard label="Active" count={activeCount} accent="green" />
        <SummaryCard label="Unconfirmed" count={unconfirmedCount} accent="amber" />
      </div>

      <SubscribersTable subscribers={all} />
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
  accent?: 'green' | 'amber'
}) {
  const dotColor =
    accent === 'green'
      ? 'bg-emerald-500'
      : accent === 'amber'
        ? 'bg-amber-500'
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
