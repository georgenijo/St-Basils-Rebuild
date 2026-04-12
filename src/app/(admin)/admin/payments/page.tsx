import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { PaymentsPageClient } from './PaymentsPageClient'
import type { Payment } from '@/components/features/PaymentsTable'

export const metadata: Metadata = {
  title: 'Payments',
}

export default async function PaymentsPage() {
  const supabase = await createClient()

  // Fetch payments with joined family, event, and share data
  const [paymentsResult, familiesResult, eventsResult, sharesResult] = await Promise.all([
    supabase
      .from('payments')
      .select(
        `
        id, family_id, type, amount, method, note,
        recorded_by, related_event_id, related_share_id,
        created_at,
        families(family_name),
        events(title),
        shares(person_name, year)
      `
      )
      .order('created_at', { ascending: false }),
    supabase.from('families').select('id, family_name').order('family_name', { ascending: true }),
    supabase.from('events').select('id, title').order('start_at', { ascending: false }),
    supabase
      .from('shares')
      .select('id, family_id, person_name, year')
      .eq('paid', false)
      .order('year', { ascending: false }),
  ])

  if (paymentsResult.error) {
    console.error('Failed to fetch payments:', paymentsResult.error)
    return (
      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="font-heading text-3xl font-semibold text-wood-900">Payments</h1>
        <p className="mt-4 font-body text-sm text-red-600">
          Failed to load payments. Please try refreshing the page.
        </p>
      </main>
    )
  }

  // Build a map of recorded_by user IDs → display names
  const recorderIds = [
    ...new Set(
      (paymentsResult.data ?? [])
        .map((p) => p.recorded_by)
        .filter((id): id is string => id !== null)
    ),
  ]

  const recorderMap = new Map<string, string>()
  if (recorderIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', recorderIds)

    for (const p of profiles ?? []) {
      recorderMap.set(p.id, p.full_name || p.email || 'Unknown')
    }
  }

  // Transform payments into the flat shape expected by PaymentsTable
  const payments: Payment[] = (paymentsResult.data ?? []).map((p) => {
    const family = p.families as unknown as { family_name: string } | null
    const event = p.events as unknown as { title: string } | null
    const share = p.shares as unknown as { person_name: string; year: number } | null

    return {
      id: p.id,
      family_id: p.family_id,
      type: p.type as Payment['type'],
      amount: p.amount,
      method: p.method,
      note: p.note,
      recorded_by: p.recorded_by,
      related_event_id: p.related_event_id,
      related_share_id: p.related_share_id,
      created_at: p.created_at,
      family_name: family?.family_name ?? null,
      event_title: event?.title ?? null,
      share_label: share ? `${share.person_name} (${share.year})` : null,
      recorded_by_name: p.recorded_by ? (recorderMap.get(p.recorded_by) ?? null) : null,
    }
  })

  // Summary counts
  const total = payments.length
  const membershipCount = payments.filter((p) => p.type === 'membership').length
  const shareCount = payments.filter((p) => p.type === 'share').length
  const eventCount = payments.filter((p) => p.type === 'event').length
  const donationCount = payments.filter((p) => p.type === 'donation').length

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-semibold text-wood-900">Payments</h1>
        <p className="mt-1 font-body text-sm text-wood-800/60">
          Record and track member payments, dues, and donations.
        </p>
      </div>

      {/* Summary cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-5">
        <SummaryCard label="Total" count={total} />
        <SummaryCard label="Membership" count={membershipCount} accent="indigo" />
        <SummaryCard label="Share" count={shareCount} accent="amber" />
        <SummaryCard label="Event" count={eventCount} accent="green" />
        <SummaryCard label="Donation" count={donationCount} accent="violet" />
      </div>

      <PaymentsPageClient
        payments={payments}
        families={familiesResult.data ?? []}
        events={eventsResult.data ?? []}
        unpaidShares={sharesResult.data ?? []}
      />
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
  accent?: 'indigo' | 'amber' | 'green' | 'violet'
}) {
  const dotColor =
    accent === 'indigo'
      ? 'bg-indigo-500'
      : accent === 'amber'
        ? 'bg-amber-500'
        : accent === 'green'
          ? 'bg-emerald-500'
          : accent === 'violet'
            ? 'bg-violet-500'
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
