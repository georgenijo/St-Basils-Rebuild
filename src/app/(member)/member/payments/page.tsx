import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui'
import { RecordDonationPanel } from '@/components/member/RecordDonationPanel'

export const metadata: Metadata = {
  title: 'Payments',
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

// ─── Badge styles by payment type ────────────────────────────���─────

const typeBadges: Record<string, { className: string; label: string }> = {
  event: { className: 'bg-amber-100 text-amber-800', label: 'Event' },
  donation: { className: 'bg-blue-100 text-blue-800', label: 'Donation' },
  share: { className: 'bg-purple-100 text-purple-800', label: 'Shares' },
}

const statusBadges = {
  paid: { className: 'bg-emerald-100 text-emerald-800', label: 'Paid' },
  due: { className: 'bg-amber-100 text-amber-800', label: 'Due' },
} as const

// ─── Dot colors for summary cards ──────────────────────────────────

const dotColors = {
  paidThisYear: 'bg-emerald-500',
  outstanding: 'bg-red-500',
  donations: 'bg-blue-500',
}

// ─── Display row type ──────────────────────────────────────────────

type DisplayRow = {
  id: string
  date: Date
  type: string
  description: string
  method: string | null
  amount: number
  status: 'paid' | 'due'
}

// ─── Page ──────────────────────────────────────────────────────────

export default async function PaymentsPage() {
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
        <h1 className="font-heading text-2xl font-semibold text-wood-900">Payments</h1>
        <p className="mt-2 text-sm text-wood-800/60">
          You are not currently assigned to a family. Please contact your church administrator.
        </p>
      </main>
    )
  }

  const familyId = profile.family_id

  // ─── Fetch data in parallel ──────────────────────────────────────
  const [paymentsResult, unpaidChargesResult] = await Promise.all([
    supabase
      .from('payments')
      .select('id, type, amount, method, note, created_at, related_event_id')
      .eq('family_id', familyId)
      .neq('type', 'membership')
      .order('created_at', { ascending: false }),
    supabase
      .from('event_charges')
      .select('id, event_id, amount, created_at')
      .eq('family_id', familyId)
      .eq('paid', false),
  ])

  const payments = paymentsResult.data ?? []
  const unpaidCharges = unpaidChargesResult.data ?? []

  // ─── Fetch event titles for both payments and charges ────────────
  const eventIdsFromPayments = payments
    .filter((p) => p.related_event_id)
    .map((p) => p.related_event_id!)
  const eventIdsFromCharges = unpaidCharges.map((c) => c.event_id)
  const allEventIds = [...new Set([...eventIdsFromPayments, ...eventIdsFromCharges])]

  let eventTitles: Record<string, string> = {}
  if (allEventIds.length > 0) {
    const { data: events } = await supabase.from('events').select('id, title').in('id', allEventIds)
    if (events) {
      eventTitles = Object.fromEntries(events.map((e) => [e.id, e.title]))
    }
  }

  // ─── Compute summary card values ────────────────────────────────
  const currentYear = new Date().getFullYear()

  const currentYearPayments = payments.filter(
    (p) => new Date(p.created_at).getFullYear() === currentYear
  )

  const paidThisYear = currentYearPayments.reduce((sum, p) => sum + Number(p.amount), 0)

  const outstanding = unpaidCharges.reduce((sum, c) => sum + Number(c.amount), 0)

  const donationsTotal = currentYearPayments
    .filter((p) => p.type === 'donation')
    .reduce((sum, p) => sum + Number(p.amount), 0)

  // ─── Build unified display rows ─────────────────────────────────
  const rows: DisplayRow[] = []

  // Add paid payments
  for (const p of payments) {
    let description: string
    switch (p.type) {
      case 'event':
        description =
          p.related_event_id && eventTitles[p.related_event_id]
            ? eventTitles[p.related_event_id]
            : 'Event payment'
        break
      case 'donation':
        description = p.note || 'Donation'
        break
      case 'share':
        description = 'Shares purchased'
        break
      default:
        description = 'Payment'
    }

    rows.push({
      id: p.id,
      date: new Date(p.created_at),
      type: p.type,
      description,
      method: p.method,
      amount: Number(p.amount),
      status: 'paid',
    })
  }

  // Add unpaid event charges
  for (const c of unpaidCharges) {
    rows.push({
      id: c.id,
      date: new Date(c.created_at),
      type: 'event',
      description: eventTitles[c.event_id] ?? 'Event charge',
      method: null,
      amount: Number(c.amount),
      status: 'due',
    })
  }

  // Sort by date descending
  rows.sort((a, b) => b.date.getTime() - a.date.getTime())

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <main className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold text-wood-900">Payments</h1>
        <p className="mt-1 text-sm text-wood-800/60">
          Event charges, donations, and share purchases
        </p>
      </div>

      {/* ─── Summary Cards ──────────────────────────────────────── */}
      <div
        className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3"
        aria-label="Payment summary"
        role="region"
      >
        {/* Paid This Year */}
        <Card variant="outlined" className="p-[18px]">
          <div className="flex items-center gap-2 text-[13px] font-medium text-wood-800/60">
            <span className={`h-2 w-2 rounded-full ${dotColors.paidThisYear}`} aria-hidden="true" />
            Paid This Year
          </div>
          <div className="mt-1.5 font-heading text-[22px] font-semibold text-wood-900">
            {usd.format(paidThisYear)}
          </div>
        </Card>

        {/* Outstanding */}
        <Card variant="outlined" className="p-[18px]">
          <div className="flex items-center gap-2 text-[13px] font-medium text-wood-800/60">
            <span className={`h-2 w-2 rounded-full ${dotColors.outstanding}`} aria-hidden="true" />
            Outstanding
          </div>
          <div
            className={`mt-1.5 font-heading text-[22px] font-semibold ${
              outstanding > 0 ? 'text-red-600' : 'text-wood-900'
            }`}
          >
            {usd.format(outstanding)}
          </div>
        </Card>

        {/* Donations */}
        <Card variant="outlined" className="p-[18px]">
          <div className="flex items-center gap-2 text-[13px] font-medium text-wood-800/60">
            <span className={`h-2 w-2 rounded-full ${dotColors.donations}`} aria-hidden="true" />
            Donations
          </div>
          <div className="mt-1.5 font-heading text-[22px] font-semibold text-wood-900">
            {usd.format(donationsTotal)}
          </div>
        </Card>
      </div>

      {/* ─── Payment History ─────────────────────────────────────── */}
      <Card variant="outlined">
        <div className="flex items-center justify-between border-b border-wood-800/[0.06] px-5 py-4">
          <h2 className="font-heading text-base font-semibold text-wood-900">Payment History</h2>
          <RecordDonationPanel />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-wood-800/5 text-left text-xs font-medium text-wood-800/50">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3">Method</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-wood-800/5">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-wood-800/40">
                    No payment history yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const badge = typeBadges[row.type] ?? {
                    className: 'bg-gray-100 text-gray-800',
                    label: row.type,
                  }
                  const status = statusBadges[row.status]

                  return (
                    <tr key={row.id}>
                      <td className="px-5 py-3 text-xs text-wood-800/60">
                        {shortDate.format(row.date)}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-wood-900">{row.description}</td>
                      <td className="px-5 py-3 text-xs capitalize text-wood-800/50">
                        {row.method ?? '—'}
                      </td>
                      <td
                        className={`px-5 py-3 text-right font-medium ${
                          row.status === 'due' ? 'text-red-600' : 'text-wood-900'
                        }`}
                      >
                        {usd.format(row.amount)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  )
}
