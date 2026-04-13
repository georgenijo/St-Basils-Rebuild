'use client'

import { useActionState, useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'
import { generateReferenceMemo } from '@/lib/reference-memo'
import { submitPayment } from '@/actions/payments'
import { Button } from '@/components/ui'

// ─── Types ───────────────────────────────────────────────────────────

interface SubmitPaymentPanelProps {
  open: boolean
  onClose: () => void
  paymentType: 'membership' | 'share' | 'event' | 'donation'
  amount: number
  familyName: string
  relatedEventId?: string
  relatedShareId?: string
  sharePersonNames?: string[]
  eventSlug?: string
  donationType?: string
}

type PaymentMethod = 'zelle' | 'venmo' | 'cashapp'

// ─── Constants ──────────────────────────────────────────────────────

const CHURCH_ZELLE_EMAIL = 'treasurer@stbasilsboston.org'
const CHURCH_VENMO_HANDLE = 'StBasilsBoston'
const CHURCH_CASHAPP_TAG = '$StBasilsBoston'

const initialState = {
  success: false,
  message: '',
  errors: undefined as Record<string, string[]> | undefined,
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'zelle', label: 'Zelle' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'cashapp', label: 'Cash App' },
]

// ─── Component ──────────────────────────────────────────────────────

export function SubmitPaymentPanel({
  open,
  onClose,
  paymentType,
  amount,
  familyName,
  relatedEventId,
  relatedShareId,
  sharePersonNames,
  eventSlug,
  donationType,
}: SubmitPaymentPanelProps) {
  const [state, formAction, isPending] = useActionState(submitPayment, initialState)
  const [method, setMethod] = useState<PaymentMethod>('zelle')
  const [copied, setCopied] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const hasTriggeredSuccess = useRef(false)

  // Generate reference memo
  const now = new Date()
  let referenceMemo = ''
  switch (paymentType) {
    case 'membership':
      referenceMemo = generateReferenceMemo({ type: 'membership', familyName, date: now })
      break
    case 'share':
      referenceMemo = generateReferenceMemo({
        type: 'share',
        familyName,
        personNames: sharePersonNames ?? [],
        year: now.getFullYear(),
      })
      break
    case 'event':
      referenceMemo = generateReferenceMemo({
        type: 'event',
        familyName,
        eventSlug: eventSlug ?? 'event',
      })
      break
    case 'donation':
      referenceMemo = generateReferenceMemo({
        type: 'donation',
        familyName,
        donationType: donationType ?? 'general',
        date: now,
      })
      break
  }

  // Handle success — auto-close after delay
  useEffect(() => {
    if (state.success && !hasTriggeredSuccess.current) {
      hasTriggeredSuccess.current = true
      const timer = setTimeout(() => {
        onClose()
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [state.success, onClose])

  // Reset on open
  useEffect(() => {
    if (open) {
      hasTriggeredSuccess.current = false
      setMethod('zelle')
      setCopied(null)
    }
  }, [open])

  // Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // Body scroll lock
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // Clipboard API not available
    }
  }

  // Deep links
  const venmoUrl = `https://venmo.com/${CHURCH_VENMO_HANDLE}?txn=pay&amount=${amount}&note=${encodeURIComponent(referenceMemo)}`
  const cashAppUrl = `https://cash.app/${CHURCH_CASHAPP_TAG}/${amount}`

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/30 transition-opacity duration-300',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Submit payment"
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-[520px] max-w-[90vw] flex-col bg-cream-50 shadow-[-8px_0_30px_rgba(0,0,0,0.12)] transition-transform duration-350',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
        style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-wood-800/10 px-6 py-4">
          <h2 className="font-heading text-xl font-semibold text-wood-900">Make a Payment</h2>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-wood-800/15 bg-white text-wood-800/60 transition-colors hover:bg-cream-100 hover:text-wood-900"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {state.success ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-amber-600"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              </div>
              <p className="mt-4 font-heading text-lg font-semibold text-wood-900">
                Pending Confirmation
              </p>
              <p className="mt-1 text-center font-body text-sm text-wood-800/60">
                Your payment has been submitted. The treasurer will confirm it within 1-2 business
                days.
              </p>
            </div>
          ) : (
            <form ref={formRef} action={formAction} className="space-y-5">
              {/* Hidden fields */}
              <input type="hidden" name="type" value={paymentType} />
              <input type="hidden" name="amount" value={amount} />
              <input type="hidden" name="method" value={method} />
              <input type="hidden" name="reference_memo" value={referenceMemo} />
              {relatedEventId && (
                <input type="hidden" name="related_event_id" value={relatedEventId} />
              )}
              {relatedShareId && (
                <input type="hidden" name="related_share_id" value={relatedShareId} />
              )}

              {/* General error */}
              {state.message && !state.success && !state.errors && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3" role="alert">
                  <p className="font-body text-sm text-red-600">{state.message}</p>
                </div>
              )}

              {/* Amount display */}
              <div className="rounded-xl border border-wood-800/10 bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="font-body text-sm text-wood-800/60">Amount</span>
                  <span className="font-heading text-2xl font-semibold text-wood-900">
                    {usd.format(amount)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-body text-sm text-wood-800/60">Type</span>
                  <span className="font-body text-sm font-medium capitalize text-wood-800">
                    {paymentType}
                  </span>
                </div>
              </div>

              {/* Reference memo */}
              <div>
                <p className="mb-1.5 font-body text-sm font-medium text-wood-800">Reference Memo</p>
                <div className="flex items-center gap-2 rounded-lg border border-wood-800/10 bg-white px-3 py-2.5">
                  <code className="flex-1 font-mono text-sm text-wood-900">{referenceMemo}</code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(referenceMemo, 'memo')}
                    className="flex-shrink-0 rounded-md border border-wood-800/15 px-2.5 py-1 font-body text-xs font-medium text-wood-800/70 transition-colors hover:bg-cream-100"
                  >
                    {copied === 'memo' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="mt-1 font-body text-xs text-wood-800/50">
                  Include this memo when sending your payment so we can match it.
                </p>
              </div>

              {/* Payment Method tabs */}
              <fieldset>
                <legend className="mb-2 block font-body text-sm font-medium text-wood-800">
                  Payment Method
                </legend>
                <div className="flex gap-1.5 rounded-lg border border-wood-800/10 bg-white p-1">
                  {METHODS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMethod(m.value)}
                      className={cn(
                        'flex-1 rounded-md px-3 py-2 font-body text-sm font-medium transition-colors',
                        method === m.value
                          ? 'bg-burgundy-700 text-cream-50'
                          : 'text-wood-800/60 hover:bg-cream-100 hover:text-wood-800'
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Method-specific instructions */}
              <div className="rounded-xl border border-wood-800/10 bg-white p-4">
                {method === 'zelle' && (
                  <div className="space-y-3">
                    <h3 className="font-body text-sm font-semibold text-wood-900">
                      Send via Zelle
                    </h3>
                    <div className="space-y-2">
                      <p className="font-body text-sm text-wood-800/70">
                        1. Open your bank app and select Zelle
                      </p>
                      <p className="font-body text-sm text-wood-800/70">
                        2. Send to the church email:
                      </p>
                      <div className="flex items-center gap-2 rounded-lg bg-cream-50 px-3 py-2">
                        <code className="flex-1 font-mono text-sm text-wood-900">
                          {CHURCH_ZELLE_EMAIL}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(CHURCH_ZELLE_EMAIL, 'email')}
                          className="flex-shrink-0 rounded-md border border-wood-800/15 px-2.5 py-1 font-body text-xs font-medium text-wood-800/70 transition-colors hover:bg-cream-100"
                        >
                          {copied === 'email' ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <p className="font-body text-sm text-wood-800/70">
                        3. Enter <strong>{usd.format(amount)}</strong> as the amount
                      </p>
                      <p className="font-body text-sm text-wood-800/70">
                        4. Paste the reference memo above in the memo/note field
                      </p>
                    </div>
                  </div>
                )}

                {method === 'venmo' && (
                  <div className="space-y-3">
                    <h3 className="font-body text-sm font-semibold text-wood-900">
                      Send via Venmo
                    </h3>
                    <div className="space-y-2">
                      <p className="font-body text-sm text-wood-800/70">
                        Click below to open Venmo with the amount and memo pre-filled:
                      </p>
                      <a
                        href={venmoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg bg-[#008CFF] px-4 py-2.5 font-body text-sm font-medium text-white transition-opacity hover:opacity-90"
                      >
                        Open in Venmo
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </a>
                      <p className="font-body text-xs text-wood-800/50">
                        Or send manually to @{CHURCH_VENMO_HANDLE} with the reference memo above.
                      </p>
                    </div>
                  </div>
                )}

                {method === 'cashapp' && (
                  <div className="space-y-3">
                    <h3 className="font-body text-sm font-semibold text-wood-900">
                      Send via Cash App
                    </h3>
                    <div className="space-y-2">
                      <p className="font-body text-sm text-wood-800/70">
                        Click below to open Cash App with the amount pre-filled:
                      </p>
                      <a
                        href={cashAppUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg bg-[#00D632] px-4 py-2.5 font-body text-sm font-medium text-white transition-opacity hover:opacity-90"
                      >
                        Open in Cash App
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </a>
                      <p className="font-body text-xs text-wood-800/50">
                        Or send manually to {CHURCH_CASHAPP_TAG} and include the reference memo in
                        the note.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Optional note */}
              <div>
                <label
                  htmlFor="submit-note"
                  className="mb-1.5 block font-body text-sm font-medium text-wood-800"
                >
                  Note <span className="font-normal text-wood-800/40">(optional)</span>
                </label>
                <input
                  id="submit-note"
                  name="note"
                  type="text"
                  maxLength={500}
                  placeholder="Any additional info..."
                  className="w-full rounded-lg border border-wood-800/15 bg-white px-3 py-2.5 font-body text-sm text-wood-900 placeholder:text-wood-800/40 transition-colors focus-visible:border-burgundy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-700/20"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isPending}>
                  {isPending ? (
                    <span className="flex items-center gap-2">
                      <svg
                        className="h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Submitting...
                    </span>
                  ) : (
                    "I've Sent the Payment"
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  )
}
