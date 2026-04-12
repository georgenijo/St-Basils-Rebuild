import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Membership',
}

// ─── Currency Formatter ──────────────────────────────────────────────

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

// ─── Page ────────────────────────────────────────────────────────────

export default async function MembershipPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null // layout redirects — this is a safety guard

  const { data: profile } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .single()

  if (!profile?.family_id) {
    return (
      <main className="p-6 lg:p-8">
        <h1 className="font-heading text-2xl font-semibold text-wood-900">Membership</h1>
        <p className="mt-2 text-sm text-wood-800/60">
          You are not currently assigned to a family. Please contact your church administrator.
        </p>
      </main>
    )
  }

  const [{ data: family }, { data: payments }] = await Promise.all([
    supabase
      .from('families')
      .select('family_name, membership_status, membership_type, membership_expires_at, created_at')
      .eq('id', profile.family_id)
      .single(),
    supabase
      .from('payments')
      .select('id, amount, method, note, created_at')
      .eq('family_id', profile.family_id)
      .eq('type', 'membership')
      .order('created_at', { ascending: false }),
  ])

  if (!family) return null

  // ─── Derived Values ──────────────────────────────────────────────

  const currentYear = new Date().getFullYear()
  const membershipPayments = payments ?? []

  const currentYearPayments = membershipPayments.filter(
    (p) => new Date(p.created_at).getFullYear() === currentYear
  )
  const monthsPaid = currentYearPayments.length
  const paidSoFar = currentYearPayments.reduce((sum, p) => sum + Number(p.amount), 0)

  const latestPaymentAmount =
    membershipPayments.length > 0 ? Number(membershipPayments[0].amount) : null

  const annualTotal =
    latestPaymentAmount !== null
      ? family.membership_type === 'annual'
        ? latestPaymentAmount
        : latestPaymentAmount * 12
      : null

  const remaining = annualTotal !== null ? Math.max(0, annualTotal - paidSoFar) : null

  const memberSince = new Date(family.created_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'America/New_York',
  })

  const paidThrough = family.membership_expires_at
    ? new Date(family.membership_expires_at + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  const nextPayment = family.membership_expires_at
    ? (() => {
        const d = new Date(family.membership_expires_at + 'T00:00:00')
        d.setDate(d.getDate() + 1)
        return d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      })()
    : null

  const progressPercent = Math.round((monthsPaid / 12) * 100)

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <main className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold text-wood-900">Membership</h1>
        <p className="mt-1 text-sm text-wood-800/60">Your membership plan and payment history.</p>
      </div>

      {/* ─── Cards Grid ──────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Current Plan */}
        <div className="rounded-2xl border border-wood-800/10 bg-cream-50">
          <div className="border-b border-wood-800/5 px-5 py-4">
            <h2 className="font-heading text-base font-semibold text-wood-900">Current Plan</h2>
          </div>
          <div className="divide-y divide-wood-800/5">
            <DetailRow label="Status">
              <StatusBadge status={family.membership_status} />
            </DetailRow>
            <DetailRow label="Plan">
              {family.membership_type
                ? family.membership_type === 'monthly'
                  ? 'Monthly'
                  : 'Annual'
                : '—'}
            </DetailRow>
            <DetailRow label="Next Payment">{nextPayment ?? '—'}</DetailRow>
            <DetailRow label="Paid Through">{paidThrough ?? '—'}</DetailRow>
            <DetailRow label="Member Since">{memberSince}</DetailRow>
          </div>
          <div className="px-5 py-4">
            <div className="mb-1 flex justify-between text-xs text-wood-800/50">
              <span>Year progress</span>
              <span>{monthsPaid} of 12 months paid</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-wood-800/10"
              role="progressbar"
              aria-valuenow={monthsPaid}
              aria-valuemin={0}
              aria-valuemax={12}
              aria-label={`${monthsPaid} of 12 months paid`}
            >
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  family.membership_status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'
                )}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Dues Summary */}
        <div className="rounded-2xl border border-wood-800/10 bg-cream-50">
          <div className="border-b border-wood-800/5 px-5 py-4">
            <h2 className="font-heading text-base font-semibold text-wood-900">
              {currentYear} Dues Summary
            </h2>
          </div>
          <div className="divide-y divide-wood-800/5">
            <DetailRow label="Annual Total">
              <span className="font-semibold text-wood-900">
                {annualTotal !== null ? usd.format(annualTotal) : '—'}
              </span>
            </DetailRow>
            <DetailRow label="Paid So Far">
              <span className="font-semibold text-emerald-600">{usd.format(paidSoFar)}</span>
            </DetailRow>
            <DetailRow label="Remaining">
              <span className="font-semibold text-amber-600">
                {remaining !== null ? usd.format(remaining) : '—'}
              </span>
            </DetailRow>
          </div>
        </div>
      </div>

      {/* ─── Payment History ─────────────────────────────────────── */}
      <div className="rounded-2xl border border-wood-800/10 bg-cream-50">
        <div className="border-b border-wood-800/5 px-5 py-4">
          <h2 className="font-heading text-base font-semibold text-wood-900">Payment History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-wood-800/5 text-left text-xs font-medium text-wood-800/50">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Period</th>
                <th className="px-5 py-3">Method</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-wood-800/5">
              {membershipPayments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-wood-800/40">
                    No membership payments recorded yet.
                  </td>
                </tr>
              ) : (
                membershipPayments.map((payment) => {
                  const date = new Date(payment.created_at)
                  return (
                    <tr key={payment.id}>
                      <td className="px-5 py-3 text-xs text-wood-800/60">
                        {date.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          timeZone: 'America/New_York',
                        })}
                      </td>
                      <td className="px-5 py-3 text-wood-900">
                        {date.toLocaleDateString('en-US', {
                          month: 'long',
                          year: 'numeric',
                          timeZone: 'America/New_York',
                        })}
                      </td>
                      <td className="px-5 py-3 text-xs capitalize text-wood-800/50">
                        {payment.method ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-wood-900">
                        {usd.format(Number(payment.amount))}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                          Paid
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}

// ─── Helper Components ───────────────────────────────────────────────

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <span className="text-sm text-wood-800/60">{label}</span>
      <span className="text-sm text-wood-900">{children}</span>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    active: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Active' },
    expired: { bg: 'bg-red-100', text: 'text-red-800', label: 'Expired' },
    pending: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Pending' },
  } as const

  const c = config[status as keyof typeof config] ?? config.pending

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        c.bg,
        c.text
      )}
    >
      {c.label}
    </span>
  )
}
