import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { SharesPageClient } from './SharesPageClient'

export const metadata: Metadata = {
  title: 'Shares',
}

export default async function SharesPage() {
  const supabase = await createClient()

  const { data: shares, error } = await supabase
    .from('shares')
    .select('id, person_name, year, amount, paid, created_at, family_id, families(family_name)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch shares:', error)
    return (
      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="font-heading text-3xl font-semibold text-wood-900">Shares</h1>
        <p className="mt-4 font-body text-sm text-red-600">
          Failed to load shares. Please try refreshing the page.
        </p>
      </main>
    )
  }

  // Flatten the joined family name and normalize the shape
  const all = (shares ?? []).map((s) => ({
    id: s.id,
    person_name: s.person_name,
    year: s.year,
    amount: Number(s.amount),
    paid: s.paid,
    created_at: s.created_at,
    family_id: s.family_id,
    family_name:
      (s.families as unknown as { family_name: string } | null)?.family_name ?? 'Unknown',
  }))

  // Distinct years for the selector (descending)
  const years = [...new Set(all.map((s) => s.year))].sort((a, b) => b - a)

  // If no shares exist yet, default the year selector to the current year
  const currentYear = new Date().getFullYear()
  if (years.length === 0) {
    years.push(currentYear)
  }

  // Summary stats for the default year (current year)
  const defaultYear = years.includes(currentYear) ? currentYear : years[0]
  const forYear = all.filter((s) => s.year === defaultYear)
  const totalShares = forYear.length
  const totalRevenue = forYear.reduce((sum, s) => sum + s.amount, 0)
  const paidCount = forYear.filter((s) => s.paid).length
  const unpaidCount = forYear.filter((s) => !s.paid).length

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-semibold text-wood-900">Shares</h1>
        <p className="mt-1 font-body text-sm text-wood-800/60">
          Manage remembrance shares and payment status.
        </p>
      </div>

      {/* Summary cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        <SummaryCard label="Total Shares" value={String(totalShares)} />
        <SummaryCard
          label="Total Revenue"
          value={`$${totalRevenue.toLocaleString('en-US')}`}
          accent="blue"
        />
        <SummaryCard label="Paid" value={String(paidCount)} accent="green" />
        <SummaryCard label="Unpaid" value={String(unpaidCount)} accent="amber" />
      </div>

      <SharesPageClient shares={all} years={years} defaultYear={defaultYear} />
    </main>
  )
}

// ─── Summary Card ─────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: 'blue' | 'green' | 'amber'
}) {
  const dotColor =
    accent === 'blue'
      ? 'bg-blue-500'
      : accent === 'green'
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
      <p className="mt-2 font-heading text-3xl font-semibold text-wood-900">{value}</p>
    </div>
  )
}
