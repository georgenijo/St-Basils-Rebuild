'use client'

import { useActionState, useEffect, useRef, useState } from 'react'

import { recordDonation } from '@/actions/donations'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'

// ─── Constants ────────────────────────────────────────────────────────

const initialState = {
  success: false,
  message: '',
  errors: undefined as Record<string, string[]> | undefined,
}

const donationTypes = [
  { value: 'general', label: 'General Donation' },
  { value: 'car_blessing', label: 'Car Blessing' },
  { value: 'christmas_caroling', label: 'Christmas Caroling' },
  { value: 'event_specific', label: 'Event Specific' },
  { value: 'other', label: 'Other' },
] as const

const inputBase =
  'w-full rounded-lg border border-wood-800/15 bg-white px-3 py-2.5 text-sm text-wood-900 placeholder:text-wood-800/40 transition-colors focus-visible:border-burgundy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-700/20'

// ─── Component ────────────────────────────────────────────────────────

export function RecordDonationPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(recordDonation, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  // Close panel on success
  useEffect(() => {
    if (state.success) {
      formRef.current?.reset()
      setIsOpen(false)
    }
  }, [state])

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Escape key closes panel
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  return (
    <>
      {/* Trigger Button */}
      <Button variant="primary" size="sm" onClick={() => setIsOpen(true)}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mr-1.5"
          aria-hidden="true"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        Record Donation
      </Button>

      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/30 transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Record a Donation"
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-[480px] max-w-[90vw] flex-col bg-cream-50 shadow-[-8px_0_30px_rgba(0,0,0,0.12)] transition-transform duration-350',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-wood-800/[0.06] px-6 py-4">
          <h2 className="font-heading text-lg font-semibold text-wood-900">Record a Donation</h2>
          <button
            onClick={() => setIsOpen(false)}
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
          <p className="mb-5 text-sm text-wood-800/60">
            Record a donation you&apos;ve made to the church.
          </p>

          {/* Server error message */}
          {!state.success && state.message && !state.errors && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3" role="alert">
              <p className="text-sm text-red-600">{state.message}</p>
            </div>
          )}

          <form ref={formRef} action={formAction} className="space-y-4">
            {/* Donation Type */}
            <div>
              <label
                htmlFor="donation_type"
                className="mb-1.5 block text-sm font-medium text-wood-900"
              >
                Donation Type
              </label>
              <select
                id="donation_type"
                name="donation_type"
                required
                className={cn(inputBase, 'appearance-none')}
                defaultValue=""
              >
                <option value="" disabled>
                  Select type…
                </option>
                {donationTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <FieldError errors={state.errors?.donation_type} />
            </div>

            {/* Amount */}
            <div>
              <label htmlFor="amount" className="mb-1.5 block text-sm font-medium text-wood-900">
                Amount
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-wood-800/40">
                  $
                </span>
                <input
                  type="number"
                  id="amount"
                  name="amount"
                  required
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  className={cn(inputBase, 'pl-7')}
                />
              </div>
              <FieldError errors={state.errors?.amount} />
            </div>

            {/* Note */}
            <div>
              <label htmlFor="note" className="mb-1.5 block text-sm font-medium text-wood-900">
                Note <span className="font-normal text-wood-800/40">(optional)</span>
              </label>
              <input
                type="text"
                id="note"
                name="note"
                placeholder="e.g. In memory of..."
                className={inputBase}
              />
              <FieldError errors={state.errors?.note} />
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 border-t border-wood-800/[0.06] pt-5">
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={isPending}>
                {isPending ? 'Submitting…' : 'Submit Donation'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null
  return (
    <p className="mt-1 text-xs text-red-600" role="alert">
      {errors[0]}
    </p>
  )
}
