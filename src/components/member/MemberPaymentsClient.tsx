'use client'

import { useState } from 'react'

import { SubmitPaymentPanel } from '@/components/member/SubmitPaymentPanel'

// ─── Types ───────────────────────────────────────────────────────────

interface OutstandingItem {
  id: string
  type: 'membership' | 'share' | 'event' | 'donation'
  description: string
  amount: number
  relatedEventId?: string
  relatedShareId?: string
  sharePersonNames?: string[]
  eventSlug?: string
}

interface MemberPaymentsClientProps {
  familyName: string
  outstandingItems: OutstandingItem[]
}

// ─── Component ──────────────────────────────────────────────────────

export function MemberPaymentsClient({ familyName, outstandingItems }: MemberPaymentsClientProps) {
  const [selectedItem, setSelectedItem] = useState<OutstandingItem | null>(null)

  return (
    <>
      {outstandingItems.length > 0 && (
        <div className="space-y-2">
          {outstandingItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-wood-800/10 bg-white px-4 py-3"
            >
              <div>
                <p className="font-body text-sm font-medium text-wood-900">{item.description}</p>
                <p className="font-body text-xs capitalize text-wood-800/50">{item.type}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-heading text-base font-semibold text-red-600">
                  ${item.amount.toFixed(2)}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedItem(item)}
                  className="rounded-lg bg-burgundy-700 px-3 py-1.5 font-body text-xs font-medium text-cream-50 transition-colors hover:bg-burgundy-800"
                >
                  Pay
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedItem && (
        <SubmitPaymentPanel
          open={selectedItem !== null}
          onClose={() => setSelectedItem(null)}
          paymentType={selectedItem.type}
          amount={selectedItem.amount}
          familyName={familyName}
          relatedEventId={selectedItem.relatedEventId}
          relatedShareId={selectedItem.relatedShareId}
          sharePersonNames={selectedItem.sharePersonNames}
          eventSlug={selectedItem.eventSlug}
        />
      )}
    </>
  )
}
