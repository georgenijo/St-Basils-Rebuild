'use client'

import { useActionState, useState } from 'react'

import { cn } from '@/lib/utils'
import { confirmPayment, rejectPayment } from '@/actions/admin-payments'
import { Button } from '@/components/ui'

// ─── Types ───────────────────────────────────────────────────────────

export interface PendingPayment {
  id: string
  family_name: string | null
  type: string
  method: string | null
  amount: number
  reference_memo: string | null
  created_at: string
}

interface PendingPaymentsQueueProps {
  payments: PendingPayment[]
}

// ─── Constants ──────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  membership: 'bg-indigo-50 text-indigo-700',
  share: 'bg-amber-50 text-amber-800',
  event: 'bg-emerald-50 text-emerald-700',
  donation: 'bg-violet-50 text-violet-700',
}

const METHOD_LABELS: Record<string, string> = {
  zelle: 'Zelle',
  venmo: 'Venmo',
  cashapp: 'Cash App',
  cash: 'Cash',
  check: 'Check',
  online: 'Online',
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const initialState = {
  success: false,
  message: '',
  errors: undefined as Record<string, string[]> | undefined,
}

// ─── Component ──────────────────────────────────────────────────────

export function PendingPaymentsQueue({ payments }: PendingPaymentsQueueProps) {
  if (payments.length === 0) return null

  return (
    <div className="mb-8">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="font-heading text-xl font-semibold text-wood-900">Pending Payments</h2>
        <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-amber-100 px-2 font-body text-xs font-semibold text-amber-800">
          {payments.length}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-amber-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-amber-100 bg-amber-50/50">
                <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wider text-wood-800/50">
                  Family
                </th>
                <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wider text-wood-800/50">
                  Type
                </th>
                <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wider text-wood-800/50">
                  Method
                </th>
                <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wider text-wood-800/50">
                  Reference
                </th>
                <th className="px-4 py-3 text-right font-body text-xs font-semibold uppercase tracking-wider text-wood-800/50">
                  Amount
                </th>
                <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wider text-wood-800/50">
                  Submitted
                </th>
                <th className="px-4 py-3 text-right font-body text-xs font-semibold uppercase tracking-wider text-wood-800/50">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <PendingPaymentRow key={payment.id} payment={payment} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Row Component ──────────────────────────────────────────────────

function PendingPaymentRow({ payment }: { payment: PendingPayment }) {
  const [confirmState, confirmAction, isConfirming] = useActionState(confirmPayment, initialState)
  const [rejectState, rejectAction, isRejecting] = useActionState(rejectPayment, initialState)
  const [showRejectForm, setShowRejectForm] = useState(false)

  if (confirmState.success || rejectState.success) {
    return null // Row disappears on success (revalidation handles the refresh)
  }

  return (
    <>
      <tr className="border-b border-wood-800/[0.06] last:border-b-0 transition-colors hover:bg-cream-50/50">
        <td className="whitespace-nowrap px-4 py-3 font-body text-sm font-medium text-wood-900">
          {payment.family_name ?? '—'}
        </td>
        <td className="whitespace-nowrap px-4 py-3">
          <span
            className={cn(
              'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
              TYPE_COLORS[payment.type] ?? 'bg-gray-50 text-gray-700'
            )}
          >
            {payment.type}
          </span>
        </td>
        <td className="whitespace-nowrap px-4 py-3 font-body text-sm text-wood-800/80">
          {METHOD_LABELS[payment.method ?? ''] ?? payment.method ?? '—'}
        </td>
        <td className="whitespace-nowrap px-4 py-3">
          <code className="font-mono text-xs text-wood-800/70">
            {payment.reference_memo ?? '—'}
          </code>
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right font-body text-sm font-medium text-wood-900 tabular-nums">
          {usd.format(payment.amount)}
        </td>
        <td className="whitespace-nowrap px-4 py-3 font-body text-sm text-wood-800/60">
          {formatDate(payment.created_at)}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            <form action={confirmAction}>
              <input type="hidden" name="payment_id" value={payment.id} />
              <Button type="submit" size="sm" disabled={isConfirming || isRejecting}>
                {isConfirming ? 'Confirming...' : 'Confirm'}
              </Button>
            </form>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowRejectForm(!showRejectForm)}
              disabled={isConfirming || isRejecting}
            >
              Reject
            </Button>
          </div>
          {confirmState.message && !confirmState.success && (
            <p className="mt-1 text-xs text-red-600">{confirmState.message}</p>
          )}
        </td>
      </tr>

      {/* Inline reject form */}
      {showRejectForm && (
        <tr className="border-b border-wood-800/[0.06]">
          <td colSpan={7} className="px-4 py-3">
            <form action={rejectAction} className="flex items-center gap-3">
              <input type="hidden" name="payment_id" value={payment.id} />
              <input
                name="reason"
                type="text"
                required
                placeholder="Reason for rejection..."
                className="flex-1 rounded-lg border border-wood-800/15 bg-white px-3 py-2 font-body text-sm text-wood-900 placeholder:text-wood-800/40 focus-visible:border-burgundy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-700/20"
              />
              <Button type="submit" variant="ghost" size="sm" disabled={isRejecting}>
                {isRejecting ? 'Rejecting...' : 'Submit'}
              </Button>
              <button
                type="button"
                onClick={() => setShowRejectForm(false)}
                className="font-body text-sm text-wood-800/50 hover:text-wood-800"
              >
                Cancel
              </button>
            </form>
            {rejectState.message && !rejectState.success && (
              <p className="mt-1 text-xs text-red-600">{rejectState.message}</p>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
