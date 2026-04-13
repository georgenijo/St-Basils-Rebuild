'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { cn } from '@/lib/utils'
import { recordPaymentReceived } from '@/actions/admin-payments'
import { Button } from '@/components/ui'

// ─── Types ───────────────────────────────────────────────────────────

interface RecordPaymentPanelProps {
  open: boolean
  onClose: () => void
  families: { id: string; family_name: string }[]
  events: { id: string; title: string }[]
  unpaidShares: { id: string; family_id: string; person_name: string; year: number }[]
}

type PaymentType = 'membership' | 'share' | 'event' | 'donation'

// ─── Constants ──────────────────────────────────────────────────────

const inputBase =
  'w-full rounded-lg border bg-cream-50 px-4 py-3 font-body text-base text-wood-800 placeholder:text-wood-800/40 transition-colors focus:border-burgundy-700 focus:outline-none focus:ring-2 focus:ring-burgundy-700/20'

const selectBase =
  'w-full appearance-none rounded-lg border bg-cream-50 px-4 py-3 pr-10 font-body text-base text-wood-800 transition-colors focus:border-burgundy-700 focus:outline-none focus:ring-2 focus:ring-burgundy-700/20'

const PAYMENT_TYPES: { value: PaymentType; label: string; description: string }[] = [
  { value: 'membership', label: 'Membership', description: 'Extends membership expiry' },
  { value: 'share', label: 'Share', description: 'Marks a share as paid' },
  { value: 'event', label: 'Event', description: 'Marks an event charge as paid' },
  { value: 'donation', label: 'Donation', description: 'General donation' },
]

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'cashapp', label: 'Cash App' },
  { value: 'online', label: 'Online' },
]

const initialState = {
  success: false,
  message: '',
  errors: undefined as Record<string, string[]> | undefined,
}

// ─── Component ──────────────────────────────────────────────────────

export function RecordPaymentPanel({
  open,
  onClose,
  families,
  events,
  unpaidShares,
}: RecordPaymentPanelProps) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(recordPaymentReceived, initialState)
  const [paymentType, setPaymentType] = useState<PaymentType>('membership')
  const [selectedFamilyId, setSelectedFamilyId] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const hasTriggeredSuccess = useRef(false)

  // Filter unpaid shares for the selected family
  const familyShares = selectedFamilyId
    ? unpaidShares.filter((s) => s.family_id === selectedFamilyId)
    : []

  // Handle success
  useEffect(() => {
    if (state.success && !hasTriggeredSuccess.current) {
      hasTriggeredSuccess.current = true
      const timer = setTimeout(() => {
        onClose()
        router.refresh()
      }, 1200)
      return () => clearTimeout(timer)
    }
  }, [state.success, onClose, router])

  // Reset form state when panel opens
  useEffect(() => {
    if (open) {
      hasTriggeredSuccess.current = false
      setPaymentType('membership')
      setSelectedFamilyId('')
      formRef.current?.reset()
    }
  }, [open])

  // Escape key handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // Prevent body scroll when panel is open
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
        aria-label="Record payment"
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-[520px] max-w-[90vw] flex-col bg-cream-50 shadow-[-8px_0_30px_rgba(0,0,0,0.12)] transition-transform duration-350',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
        style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-wood-800/10 px-6 py-4">
          <h2 className="font-heading text-xl font-semibold text-wood-900">Record Payment</h2>
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
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-emerald-600"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="mt-4 font-heading text-lg font-semibold text-wood-900">
                Payment Recorded
              </p>
              <p className="mt-1 font-body text-sm text-wood-800/60">{state.message}</p>
            </div>
          ) : (
            <form ref={formRef} action={formAction} className="space-y-5">
              {/* General error */}
              {state.message && !state.errors && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3" role="alert">
                  <p className="font-body text-sm text-red-600">{state.message}</p>
                </div>
              )}

              {/* Family */}
              <div>
                <label
                  htmlFor="family_id"
                  className="mb-1.5 block font-body text-sm font-medium text-wood-800"
                >
                  Family <span className="text-burgundy-700">*</span>
                </label>
                <div className="relative">
                  <select
                    id="family_id"
                    name="family_id"
                    required
                    value={selectedFamilyId}
                    onChange={(e) => setSelectedFamilyId(e.target.value)}
                    className={cn(selectBase, state.errors?.family_id && 'border-red-400')}
                    aria-invalid={Boolean(state.errors?.family_id)}
                    aria-describedby={state.errors?.family_id ? 'family_id-error' : undefined}
                  >
                    <option value="">Select a family...</option>
                    {families.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.family_name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown />
                </div>
                <FieldError id="family_id-error" errors={state.errors?.family_id} />
              </div>

              {/* Payment Type */}
              <fieldset>
                <legend className="mb-1.5 block font-body text-sm font-medium text-wood-800">
                  Payment Type <span className="text-burgundy-700">*</span>
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_TYPES.map((pt) => (
                    <label
                      key={pt.value}
                      className={cn(
                        'flex cursor-pointer flex-col rounded-lg border px-3 py-2.5 transition-colors',
                        paymentType === pt.value
                          ? 'border-burgundy-700 bg-burgundy-700/[0.06]'
                          : 'border-wood-800/15 bg-white hover:bg-cream-100'
                      )}
                    >
                      <input
                        type="radio"
                        name="type"
                        value={pt.value}
                        checked={paymentType === pt.value}
                        onChange={() => setPaymentType(pt.value)}
                        className="sr-only"
                      />
                      <span
                        className={cn(
                          'font-body text-sm font-medium',
                          paymentType === pt.value ? 'text-burgundy-700' : 'text-wood-800'
                        )}
                      >
                        {pt.label}
                      </span>
                      <span className="font-body text-xs text-wood-800/50">{pt.description}</span>
                    </label>
                  ))}
                </div>
                <FieldError id="type-error" errors={state.errors?.type} />
              </fieldset>

              {/* Conditional: Event selector */}
              {paymentType === 'event' && (
                <div>
                  <label
                    htmlFor="related_event_id"
                    className="mb-1.5 block font-body text-sm font-medium text-wood-800"
                  >
                    Event <span className="text-burgundy-700">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="related_event_id"
                      name="related_event_id"
                      required
                      className={cn(selectBase, state.errors?.related_event_id && 'border-red-400')}
                      aria-invalid={Boolean(state.errors?.related_event_id)}
                      aria-describedby={
                        state.errors?.related_event_id ? 'related_event_id-error' : undefined
                      }
                    >
                      <option value="">Select an event...</option>
                      {events.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.title}
                        </option>
                      ))}
                    </select>
                    <ChevronDown />
                  </div>
                  <FieldError id="related_event_id-error" errors={state.errors?.related_event_id} />
                </div>
              )}

              {/* Conditional: Share selector */}
              {paymentType === 'share' && (
                <div>
                  <label
                    htmlFor="related_share_id"
                    className="mb-1.5 block font-body text-sm font-medium text-wood-800"
                  >
                    Share <span className="text-burgundy-700">*</span>
                  </label>
                  {!selectedFamilyId ? (
                    <p className="font-body text-sm text-wood-800/50">
                      Select a family first to see unpaid shares.
                    </p>
                  ) : familyShares.length === 0 ? (
                    <p className="font-body text-sm text-wood-800/50">
                      No unpaid shares for this family.
                    </p>
                  ) : (
                    <div className="relative">
                      <select
                        id="related_share_id"
                        name="related_share_id"
                        required
                        className={cn(
                          selectBase,
                          state.errors?.related_share_id && 'border-red-400'
                        )}
                        aria-invalid={Boolean(state.errors?.related_share_id)}
                        aria-describedby={
                          state.errors?.related_share_id ? 'related_share_id-error' : undefined
                        }
                      >
                        <option value="">Select a share...</option>
                        {familyShares.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.person_name} ({s.year}) — $50.00
                          </option>
                        ))}
                      </select>
                      <ChevronDown />
                    </div>
                  )}
                  <FieldError id="related_share_id-error" errors={state.errors?.related_share_id} />
                </div>
              )}

              {/* Amount */}
              <div>
                <label
                  htmlFor="amount"
                  className="mb-1.5 block font-body text-sm font-medium text-wood-800"
                >
                  Amount <span className="text-burgundy-700">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-body text-base text-wood-800/50">
                    $
                  </span>
                  <input
                    id="amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    className={cn(inputBase, 'pl-8', state.errors?.amount && 'border-red-400')}
                    aria-invalid={Boolean(state.errors?.amount)}
                    aria-describedby={state.errors?.amount ? 'amount-error' : undefined}
                  />
                </div>
                <FieldError id="amount-error" errors={state.errors?.amount} />
              </div>

              {/* Method */}
              <div>
                <label
                  htmlFor="method"
                  className="mb-1.5 block font-body text-sm font-medium text-wood-800"
                >
                  Payment Method <span className="text-burgundy-700">*</span>
                </label>
                <div className="relative">
                  <select
                    id="method"
                    name="method"
                    required
                    className={cn(selectBase, state.errors?.method && 'border-red-400')}
                    aria-invalid={Boolean(state.errors?.method)}
                    aria-describedby={state.errors?.method ? 'method-error' : undefined}
                  >
                    <option value="">Select method...</option>
                    {METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown />
                </div>
                <FieldError id="method-error" errors={state.errors?.method} />
              </div>

              {/* Note */}
              <div>
                <label
                  htmlFor="note"
                  className="mb-1.5 block font-body text-sm font-medium text-wood-800"
                >
                  Note <span className="font-normal text-wood-800/40">(optional)</span>
                </label>
                <textarea
                  id="note"
                  name="note"
                  rows={3}
                  maxLength={500}
                  placeholder="Check number, reference, or any notes..."
                  className={cn(inputBase, 'resize-none')}
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
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
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
                      Recording...
                    </span>
                  ) : (
                    'Record Payment'
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

// ─── Sub-components ─────────────────────────────────────────────────

function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null
  return (
    <p id={id} className="mt-1 font-body text-sm text-red-600" role="alert">
      {errors[0]}
    </p>
  )
}

function ChevronDown() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-wood-800/40"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}
