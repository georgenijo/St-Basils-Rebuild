import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Member Portal',
  description: "Your St. Basil's parish member portal.",
}

// ─── Date formatting ───────────────────────────────────────────────

const shortDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'America/New_York',
})

const fullDate = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'America/New_York',
})

// ─── Badge styles by payment type ──────────────────────────────────

const badgeStyles: Record<string, { className: string; label: string }> = {
  membership: { className: 'bg-emerald-100 text-emerald-800', label: 'Paid' },
  donation: { className: 'bg-blue-100 text-blue-800', label: 'Donation' },
  share: { className: 'bg-purple-100 text-purple-800', label: 'Share' },
  event: { className: 'bg-amber-100 text-amber-800', label: 'Event' },
}

// ─── Summary card dot colors ───────────────────────────────────────

const dotColors = {
  nextDue: 'bg-emerald-500',
  family: 'bg-blue-500',
  shares: 'bg-gold-500',
  balance: 'bg-red-500',
}

// ─── Page ──────────────────────────────────────────────────────────

export default async function MemberOverviewPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null // Layout handles redirect

  // Get profile with family_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .single()

  const familyId = profile?.family_id

  // ─── No-family state ──────────────────────────────────────────
  if (!familyId) {
    return (
      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="font-heading text-2xl font-semibold text-wood-900">
          Welcome to your Parish Portal
        </h1>
        <Card variant="outlined" className="mt-6 p-6">
          <p className="text-sm text-wood-800/60">
            Your family hasn&apos;t been set up yet. Please contact the church office to get
            started.
          </p>
        </Card>
      </main>
    )
  }

  // ─── Fetch all data in parallel ───────────────────────────────
  const currentYear = new Date().getFullYear()

  const [familyResult, membersResult, sharesResult, paymentsResult, unpaidChargesResult] =
    await Promise.all([
      supabase
        .from('families')
        .select('membership_status, membership_type, membership_expires_at')
        .eq('id', familyId)
        .single(),
      supabase
        .from('family_members')
        .select('id', { count: 'exact', head: true })
        .eq('family_id', familyId),
      supabase.from('shares').select('id').eq('family_id', familyId).eq('year', currentYear),
      supabase
        .from('payments')
        .select('id, type, amount, note, created_at, related_event_id')
        .eq('family_id', familyId)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase.from('event_charges').select('amount').eq('family_id', familyId).eq('paid', false),
    ])

  const family = familyResult.data
  const memberCount = membersResult.count ?? 0
  const sharesCount = sharesResult.data?.length ?? 0
  const recentPayments = paymentsResult.data ?? []

  // ─── Compute balance (sum of unpaid event charges) ────────────
  const outstandingBalance =
    unpaidChargesResult.data?.reduce((sum, charge) => sum + Number(charge.amount), 0) ?? 0

  // ─── Compute "Next Due" card ──────────────────────────────────
  let nextDueValue = '—'
  let nextDueSub = ''
  if (family?.membership_status === 'expired') {
    nextDueValue = 'Expired'
    nextDueSub = family.membership_expires_at
      ? `since ${fullDate.format(new Date(family.membership_expires_at + 'T00:00:00'))}`
      : ''
  } else if (family?.membership_status === 'active' && family.membership_expires_at) {
    const expiresDate = new Date(family.membership_expires_at + 'T00:00:00')
    nextDueValue = shortDate.format(expiresDate)
    const amountLabel = family.membership_type === 'monthly' ? '$100' : '$1,200'
    const typeLabel = family.membership_type === 'monthly' ? 'Monthly' : 'Annual'
    nextDueSub = `${amountLabel} · ${typeLabel}`
  }

  // ─── Fetch event titles for payments that reference events ────
  const eventIds = recentPayments.filter((p) => p.related_event_id).map((p) => p.related_event_id!)

  let eventTitles: Record<string, string> = {}
  if (eventIds.length > 0) {
    const { data: events } = await supabase.from('events').select('id, title').in('id', eventIds)
    if (events) {
      eventTitles = Object.fromEntries(events.map((e) => [e.id, e.title]))
    }
  }

  // ─── Build activity descriptions ─────────────────────────────
  function describePayment(p: (typeof recentPayments)[number]): string {
    switch (p.type) {
      case 'membership': {
        const date = new Date(p.created_at)
        const monthYear = date.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
          timeZone: 'America/New_York',
        })
        return `Membership — ${monthYear}`
      }
      case 'event':
        return p.related_event_id && eventTitles[p.related_event_id]
          ? eventTitles[p.related_event_id]
          : 'Event payment'
      case 'donation':
        return p.note || 'Donation'
      case 'share':
        return `Purchased shares`
      default:
        return 'Payment'
    }
  }

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="font-heading text-2xl font-semibold text-wood-900">Overview</h1>
      <p className="mt-1 text-sm text-wood-800/60">Your family&apos;s parish snapshot</p>

      {/* ─── Summary Cards ────────────────────────────────────────── */}
      <div
        className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4"
        aria-label="Summary cards"
        role="region"
      >
        {/* Next Due */}
        <Card variant="outlined" className="p-[18px]">
          <div className="flex items-center gap-2 text-[13px] font-medium text-wood-800/60">
            <span className={`h-2 w-2 rounded-full ${dotColors.nextDue}`} aria-hidden="true" />
            Next Due
          </div>
          <div className="mt-1.5 font-heading text-[22px] font-semibold text-wood-900">
            {nextDueValue}
          </div>
          {nextDueSub && <div className="mt-0.5 text-xs text-wood-800/45">{nextDueSub}</div>}
        </Card>

        {/* Family */}
        <Card variant="outlined" className="p-[18px]">
          <div className="flex items-center gap-2 text-[13px] font-medium text-wood-800/60">
            <span className={`h-2 w-2 rounded-full ${dotColors.family}`} aria-hidden="true" />
            Family
          </div>
          <div className="mt-1.5 font-heading text-[26px] font-semibold text-wood-900">
            {memberCount}
          </div>
          <div className="mt-0.5 text-xs text-wood-800/45">
            {memberCount === 1 ? 'member' : 'members'}
          </div>
        </Card>

        {/* Shares */}
        <Card variant="outlined" className="p-[18px]">
          <div className="flex items-center gap-2 text-[13px] font-medium text-wood-800/60">
            <span className={`h-2 w-2 rounded-full ${dotColors.shares}`} aria-hidden="true" />
            Shares
          </div>
          <div className="mt-1.5 font-heading text-[26px] font-semibold text-wood-900">
            {sharesCount}
          </div>
          <div className="mt-0.5 text-xs text-wood-800/45">
            {sharesCount === 1 ? 'name this year' : 'names this year'}
          </div>
        </Card>

        {/* Balance */}
        <Card variant="outlined" className="p-[18px]">
          <div className="flex items-center gap-2 text-[13px] font-medium text-wood-800/60">
            <span className={`h-2 w-2 rounded-full ${dotColors.balance}`} aria-hidden="true" />
            Balance
          </div>
          <div
            className={`mt-1.5 font-heading text-[26px] font-semibold ${
              outstandingBalance > 0 ? 'text-red-600' : 'text-wood-900'
            }`}
          >
            {`$${outstandingBalance.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          </div>
          <div className="mt-0.5 text-xs text-wood-800/45">
            {outstandingBalance > 0 ? 'outstanding' : 'all clear'}
          </div>
        </Card>
      </div>

      {/* ─── Recent Activity ──────────────────────────────────────── */}
      <div className="mt-7">
        <Card variant="outlined">
          <div className="flex items-center justify-between border-b border-wood-800/[0.06] px-[18px] py-3.5">
            <h2 className="text-[15px] font-semibold text-wood-900">Recent Activity</h2>
          </div>
          {recentPayments.length === 0 ? (
            <div className="px-[18px] py-10 text-center text-sm text-wood-800/40">
              No recent activity
            </div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {recentPayments.map((payment) => {
                  const badge = badgeStyles[payment.type] ?? {
                    className: 'bg-gray-100 text-gray-800',
                    label: payment.type,
                  }
                  return (
                    <tr
                      key={payment.id}
                      className="border-b border-wood-800/[0.05] last:border-b-0 hover:bg-wood-800/[0.015]"
                    >
                      <td className="px-[18px] py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-[18px] py-3 text-wood-900">{describePayment(payment)}</td>
                      <td className="px-[18px] py-3 text-right font-heading font-semibold text-wood-900">
                        {`$${Number(payment.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </td>
                      <td className="px-[18px] py-3 text-right text-[13px] text-wood-800/40">
                        {shortDate.format(new Date(payment.created_at))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </main>
  )
}
