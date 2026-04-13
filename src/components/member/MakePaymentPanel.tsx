'use client'

import { useActionState, useEffect, useRef, useState } from 'react'

import { submitPayment } from '@/actions/payments'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────

type PaymentMethod = 'zelle' | 'venmo' | 'cashapp'

interface MakePaymentPanelProps {
  open: boolean
  onClose: () => void
  paymentType: string
  amount: number
  referenceMemo: string
  relatedEventId?: string
  relatedShareId?: string
  zelleEmail: string
  venmoHandle: string
  cashappTag: string
}

// ─── Constants ──────────────────────────────────────────────────────

const initialState = {
  success: false,
  message: '',
  errors: undefined as Record<string, string[]> | undefined,
}

const inputBase =
  'w-full rounded-lg border border-wood-800/15 bg-white px-3 py-2.5 text-sm text-wood-900 placeholder:text-wood-800/40 transition-colors focus-visible:border-burgundy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-700/20'

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

const METHOD_TABS: { value: PaymentMethod; label: string }[] = [
  { value: 'zelle', label: 'Zelle' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'cashapp', label: 'Cash App' },
]

// ─── Component ──────────────────────────────────────────────────────

export function MakePaymentPanel({
  open,
  onClose,
  paymentType,
  amount,
  referenceMemo,
  relatedEventId,
  relatedShareId,
  zelleEmail,
  venmoHandle,
  cashappTag,
}: MakePaymentPanelProps) {
  const [method, setMethod] = useState<PaymentMethod>('zelle')
  const [copied, setCopied] = useState<string | null>(null)
  const [state, formAction, isPending] = useActionState(submitPayment, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  // Close panel on success after delay
  useEffect(() => {
    if (state.success) {
      const timer = setTimeout(() => {
        onClose()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [state.success, onClose])

  // Reset state when panel opens
  useEffect(() => {
    if (open) {
      setMethod('zelle')
      setCopied(null)
    }
  }, [open])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  // Escape key
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  // Build deep links
  const venmoUrl = `https://venmo.com/u/${venmoHandle}?txn=pay&amount=${amount}&note=${encodeURIComponent(referenceMemo)}`
  const cashappUrl = `https://cash.app/$${cashappTag}/${amount}`

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
        aria-label="Make a Payment"
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-[520px] max-w-[90vw] flex-col bg-cream-50 shadow-[-8px_0_30px_rgba(0,0,0,0.12)] transition-transform duration-350',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
        style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-wood-800/[0.06] px-6 py-4">
          <h2 className="font-heading text-lg font-semibold text-wood-900">Make a Payment</h2>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-wood-800/50 transition-colors hover:bg-wood-800/5 hover:text-wood-900"
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
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {state.success ? (
            /* ─── Success state ────────────────────────────── */
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
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <p className="mt-4 font-heading text-lg font-semibold text-wood-900">
                Pending Confirmation
              </p>
              <p className="mt-1 text-center text-sm text-wood-800/60">
                Your payment has been submitted. The treasurer will confirm it once the transfer is
                received — usually 1-2 business days.
              </p>
            </div>
          ) : (
            /* ─── Payment form ─────────────────────────────── */
            <>
              {/* Payment summary */}
              <div className="mb-5 rounded-lg border border-wood-800/10 bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize text-wood-800/60">
                    {paymentType}
                  </span>
                  <span className="font-heading text-xl font-semibold text-wood-900">
                    {usd.format(amount)}
                  </span>
                </div>
              </div>

              {/* Method tabs */}
              <div className="mb-5">
                <p className="mb-2 text-sm font-medium text-wood-900">Choose payment method</p>
                <div className="flex gap-2">
                  {METHOD_TABS.map((tab) => (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setMethod(tab.value)}
                      className={cn(
                        'flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                        method === tab.value
                          ? 'border-burgundy-700 bg-burgundy-700/[0.06] text-burgundy-700'
                          : 'border-wood-800/15 bg-white text-wood-800/60 hover:bg-cream-100'
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Per-method instructions */}
              <div className="mb-5 rounded-lg border border-wood-800/10 bg-white p-4">
                {method === 'zelle' && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-wood-900">Send via Zelle</p>
                    <ol className="list-inside list-decimal space-y-2 text-sm text-wood-800/70">
                      <li>Open your banking app and select &quot;Send Money with Zelle&quot;</li>
                      <li>
                        Send to:{' '}
                        <span className="font-mono font-medium text-wood-900">{zelleEmail}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(zelleEmail, 'email')}
                          className="ml-2 inline-flex items-center rounded bg-cream-100 px-2 py-0.5 text-xs font-medium text-burgundy-700 transition-colors hover:bg-burgundy-700/10"
                        >
                          {copied === 'email' ? 'Copied!' : 'Copy'}
                        </button>
                      </li>
                      <li>Enter the amount: {usd.format(amount)}</li>
                      <li>Paste the reference memo (below) in the note field</li>
                      <li>Review and send</li>
                    </ol>
                  </div>
                )}

                {method === 'venmo' && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-wood-900">Send via Venmo</p>
                    <ol className="list-inside list-decimal space-y-2 text-sm text-wood-800/70">
                      <li>Tap the button below to open Venmo with amount pre-filled</li>
                      <li>Verify the amount and memo are correct</li>
                      <li>Tap &quot;Pay&quot; in the Venmo app</li>
                    </ol>
                    <a
                      href={venmoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#008CFF] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                    >
                      Open Venmo
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
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </a>
                  </div>
                )}

                {method === 'cashapp' && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-wood-900">Send via Cash App</p>
                    <ol className="list-inside list-decimal space-y-2 text-sm text-wood-800/70">
                      <li>Tap the button below to open Cash App</li>
                      <li>Verify the amount is correct</li>
                      <li>
                        <strong>Important:</strong> Paste the reference memo (below) in the
                        &quot;For&quot; field
                      </li>
                      <li>Tap &quot;Pay&quot;</li>
                    </ol>
                    <a
                      href={cashappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#00D632] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                    >
                      Open Cash App
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
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </a>
                  </div>
                )}
              </div>

              {/* Reference memo */}
              <div className="mb-5">
                <p className="mb-2 text-sm font-medium text-wood-900">Reference memo</p>
                <p className="mb-1.5 text-xs text-wood-800/50">
                  Copy this code and paste it in the payment note so the treasurer can match your
                  transfer.
                </p>
                <div className="flex items-center gap-2">
                  <div className={cn(inputBase, 'flex-1 font-mono text-sm tracking-wide')}>
                    {referenceMemo}
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(referenceMemo, 'memo')}
                    className="shrink-0 rounded-lg border border-wood-800/15 bg-white px-3 py-2.5 text-sm font-medium text-wood-900 transition-colors hover:bg-cream-100"
                  >
                    {copied === 'memo' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Server error */}
              {!state.success && state.message && !state.errors && (
                <div
                  className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3"
                  role="alert"
                >
                  <p className="text-sm text-red-600">{state.message}</p>
                </div>
              )}

              {/* Submit form */}
              <form ref={formRef} action={formAction}>
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

                <div className="flex justify-end gap-2 border-t border-wood-800/[0.06] pt-5">
                  <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm" disabled={isPending}>
                    {isPending ? 'Submitting…' : "I've sent the payment"}
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  )
}
