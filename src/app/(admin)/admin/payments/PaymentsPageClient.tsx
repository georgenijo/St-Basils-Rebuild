'use client'

import { useState } from 'react'

import { PaymentsTable } from '@/components/features/PaymentsTable'
import { RecordPaymentPanel } from '@/components/features/RecordPaymentPanel'
import { PendingPaymentsQueue } from '@/components/features/PendingPaymentsQueue'
import type { Payment } from '@/components/features/PaymentsTable'
import type { PendingPayment } from '@/components/features/PendingPaymentsQueue'

interface PaymentsPageClientProps {
  payments: Payment[]
  pendingPayments: PendingPayment[]
  families: { id: string; family_name: string }[]
  events: { id: string; title: string }[]
  unpaidShares: { id: string; family_id: string; person_name: string; year: number }[]
}

export function PaymentsPageClient({
  payments,
  pendingPayments,
  families,
  events,
  unpaidShares,
}: PaymentsPageClientProps) {
  const [panelOpen, setPanelOpen] = useState(false)

  return (
    <>
      <PendingPaymentsQueue payments={pendingPayments} />

      <div className="mb-6 flex items-center justify-end">
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
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
          Record Payment
        </button>
      </div>

      <PaymentsTable payments={payments} />

      <RecordPaymentPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        families={families}
        events={events}
        unpaidShares={unpaidShares}
      />
    </>
  )
}
