'use client'

import { useActionState, useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'
import { updateFamilyDetails } from '@/actions/family'
import { Button } from '@/components/ui'

// ─── Types ───────────────────────────────────────────────────────────

interface EditFamilyPanelProps {
  open: boolean
  onClose: () => void
  family: {
    family_name: string
    phone: string | null
    address: string | null
  }
}

// ─── Component ───────────────────────────────────────────────────────

export function EditFamilyPanel({ open, onClose, family }: EditFamilyPanelProps) {
  const [state, formAction, isPending] = useActionState(updateFamilyDetails, {
    success: false,
    message: '',
  })
  const hasTriggeredSuccess = useRef(false)

  // Close on success
  useEffect(() => {
    if (state.success && !hasTriggeredSuccess.current) {
      hasTriggeredSuccess.current = true
      onClose()
    }
  }, [state.success, onClose])

  // Reset success flag when panel reopens
  useEffect(() => {
    if (open) {
      hasTriggeredSuccess.current = false
    }
  }, [open])

  // Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) {
        onClose()
      }
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
        aria-label="Edit family details"
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-[520px] max-w-[90vw] flex-col bg-cream-50 shadow-[-8px_0_30px_rgba(0,0,0,0.12)] transition-transform duration-350',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
        style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-wood-800/10 px-6 py-5">
          <h3 className="font-heading text-lg font-semibold text-wood-900">Edit Family Details</h3>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-wood-800/15 bg-white text-wood-800/60 transition-colors hover:bg-cream-100 hover:text-wood-900"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <form action={formAction} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex-1 px-6 py-6">
            {/* Error message */}
            {state.message && !state.success && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3" role="alert">
                <p className="text-sm text-red-600">{state.message}</p>
              </div>
            )}

            {/* Family Name */}
            <div className="mb-5">
              <label htmlFor="edit-family-name" className="mb-1.5 block text-sm font-medium text-wood-900">
                Family Name
              </label>
              <input
                id="edit-family-name"
                name="family_name"
                type="text"
                required
                defaultValue={family.family_name}
                className="w-full rounded-lg border border-wood-800/15 bg-white px-3.5 py-2.5 text-sm text-wood-900 placeholder:text-wood-800/30 focus:border-burgundy-700 focus:outline-none focus:ring-1 focus:ring-burgundy-700"
              />
              {state.errors?.family_name && (
                <p className="mt-1 text-xs text-red-600">{state.errors.family_name[0]}</p>
              )}
            </div>

            {/* Phone */}
            <div className="mb-5">
              <label htmlFor="edit-family-phone" className="mb-1.5 block text-sm font-medium text-wood-900">
                Phone
              </label>
              <input
                id="edit-family-phone"
                name="phone"
                type="tel"
                defaultValue={family.phone ?? ''}
                className="w-full rounded-lg border border-wood-800/15 bg-white px-3.5 py-2.5 text-sm text-wood-900 placeholder:text-wood-800/30 focus:border-burgundy-700 focus:outline-none focus:ring-1 focus:ring-burgundy-700"
              />
              {state.errors?.phone && (
                <p className="mt-1 text-xs text-red-600">{state.errors.phone[0]}</p>
              )}
            </div>

            {/* Address */}
            <div className="mb-5">
              <label htmlFor="edit-family-address" className="mb-1.5 block text-sm font-medium text-wood-900">
                Address
              </label>
              <input
                id="edit-family-address"
                name="address"
                type="text"
                defaultValue={family.address ?? ''}
                className="w-full rounded-lg border border-wood-800/15 bg-white px-3.5 py-2.5 text-sm text-wood-900 placeholder:text-wood-800/30 focus:border-burgundy-700 focus:outline-none focus:ring-1 focus:ring-burgundy-700"
              />
              {state.errors?.address && (
                <p className="mt-1 text-xs text-red-600">{state.errors.address[0]}</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t border-wood-800/10 px-6 py-4">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}

// ─── Icons ───────────────────────────────────────────────────────────

function CloseIcon() {
  return (
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
  )
}
