import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui'
import { BuySharesPanel } from './BuySharesPanel'

export const metadata: Metadata = {
  title: 'Shares',
}

// ─── Formatters ─────────────────────────────────────────────────────

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const shortDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'America/New_York',
})

// ─── Dot colors ─────────────────────────────────────────────────────

const dotColors = {
  thisYear: 'bg-gold-500',
  spent: 'bg-emerald-500',
  allTime: 'bg-blue-500',
}

// ─── Page ───────────────────────────────────────────────────────────

export default async function SharesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null // Layout handles redirect

  const { data: profile } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .single()

  if (!profile?.family_id) {
    return (
      <main className="p-6 lg:p-8">
        <h1 className="font-heading text-2xl font-semibold text-wood-900">Shares</h1>
        <p className="mt-2 text-sm text-wood-800/60">
          You are not currently assigned to a family. Please contact your church administrator.
        </p>
      </main>
    )
  }

  const familyId = profile.family_id
  const currentYear = new Date().getFullYear()

  // ─── Fetch all data in parallel ─────────────────────────────────
  const [currentYearResult, allTimeResult, previousYearsResult] = await Promise.all([
    supabase
      .from('shares')
      .select('id, person_name, amount, paid, created_at')
      .eq('family_id', familyId)
      .eq('year', currentYear)
      .order('created_at', { ascending: false }),
    supabase
      .from('shares')
      .select('id', { count: 'exact', head: true })
      .eq('family_id', familyId),
    supabase
      .from('shares')
      .select('year, amount')
      .eq('family_id', familyId)
      .neq('year', currentYear)
      .order('year', { ascending: false }),
  ])

  const currentYearShares = currentYearResult.data ?? []
  const allTimeCount = allTimeResult.count ?? 0
  const previousSharesRaw = previousYearsResult.data ?? []

  // ─── Derived values ─────────────────────────────────────────────
  const sharesThisYear = currentYearShares.length
  const totalSpentThisYear = sharesThisYear * 50

  // Group previous years: { year: number, count: number, total: number }
  const previousYears = Object.values(
    previousSharesRaw.reduce<Record<number, { year: number; count: number; total: number }>>(
      (acc, share) => {
        if (!acc[share.year]) {
          acc[share.year] = { year: share.year, count: 0, total: 0 }
        }
        acc[share.year].count += 1
        acc[share.year].total += Number(share.amount)
        return acc
      },
      {}
    )
  ).sort((a, b) => b.year - a.year)

  // Earliest year for "since YYYY" subtitle
  const allYears = [
    ...currentYearShares.map(() => currentYear),
    ...previousSharesRaw.map((s) => s.year),
  ]
  const earliestYear = allYears.length > 0 ? Math.min(...allYears) : currentYear

  return (
    <main className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold text-wood-900">Shares</h1>
        <p className="mt-1 text-sm text-wood-800/60">
          Names remembered in weekly church services.
        </p>
      </div>

      {/* ─── Summary Cards ──────────────────────────────────────── */}
      <div
        className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3"
        aria-label="Shares summary"
        role="region"
      >
        {/* Shares This Year */}
        <Card variant="outlined" className="p-[18px]">
          <div className="flex items-center gap-2 text-[13px] font-medium text-wood-800/60">
            <span className={`h-2 w-2 rounded-full ${dotColors.thisYear}`} aria-hidden="true" />
            Shares This Year
          </div>
          <div className="mt-1.5 font-heading text-[26px] font-semibold text-wood-900">
            {sharesThisYear}
          </div>
          <div className="mt-0.5 text-xs text-wood-800/45">names remembered</div>
        </Card>

        {/* Total Spent */}
        <Card variant="outlined" className="p-[18px]">
          <div className="flex items-center gap-2 text-[13px] font-medium text-wood-800/60">
            <span className={`h-2 w-2 rounded-full ${dotColors.spent}`} aria-hidden="true" />
            Total Spent
          </div>
          <div className="mt-1.5 font-heading text-[26px] font-semibold text-wood-900">
            ${totalSpentThisYear.toLocaleString('en-US')}
          </div>
          <div className="mt-0.5 text-xs text-wood-800/45">
            {sharesThisYear} x $50
          </div>
        </Card>

        {/* All-Time */}
        <Card variant="outlined" className="p-[18px]">
          <div className="flex items-center gap-2 text-[13px] font-medium text-wood-800/60">
            <span className={`h-2 w-2 rounded-full ${dotColors.allTime}`} aria-hidden="true" />
            All-Time
          </div>
          <div className="mt-1.5 font-heading text-[26px] font-semibold text-wood-900">
            {allTimeCount}
          </div>
          <div className="mt-0.5 text-xs text-wood-800/45">
            {allTimeCount === 1 ? 'share' : 'shares'} since {earliestYear}
          </div>
        </Card>
      </div>

      {/* ─── Current Year Header + Buy Button ───────────────────── */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-heading text-base font-semibold text-wood-900">
          {currentYear} Shares
        </h2>
        <BuySharesPanel />
      </div>

      {/* ─── Current Year Shares Table ──────────────────────────── */}
      <div className="mb-6 rounded-2xl border border-wood-800/10 bg-cream-50">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-wood-800/5 text-left text-xs font-medium text-wood-800/50">
                <th className="px-5 py-3">Name Remembered</th>
                <th className="px-5 py-3">Amount</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Purchased</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-wood-800/5">
              {currentYearShares.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-sm text-wood-800/40">
                    No shares purchased this year.
                  </td>
                </tr>
              ) : (
                currentYearShares.map((share) => (
                  <tr key={share.id}>
                    <td className="px-5 py-3 font-medium text-wood-900">{share.person_name}</td>
                    <td className="px-5 py-3 text-wood-900">{usd.format(Number(share.amount))}</td>
                    <td className="px-5 py-3">
                      {share.paid ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                          Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Unpaid
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-[13px] text-wood-800/50">
                      {shortDate.format(new Date(share.created_at))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Previous Years ─────────────────────────────────────── */}
      <div className="rounded-2xl border border-wood-800/10 bg-cream-50">
        <div className="border-b border-wood-800/5 px-5 py-4">
          <h2 className="font-heading text-base font-semibold text-wood-900">Previous Years</h2>
        </div>
        {previousYears.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-wood-800/40">
            No shares from previous years.
          </div>
        ) : (
          <div className="divide-y divide-wood-800/5">
            {previousYears.map((yearData) => (
              <div key={yearData.year} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-wood-800/60">{yearData.year}</span>
                <span className="text-sm text-wood-900">
                  {yearData.count} {yearData.count === 1 ? 'share' : 'shares'} &middot;{' '}
                  {usd.format(yearData.total)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
