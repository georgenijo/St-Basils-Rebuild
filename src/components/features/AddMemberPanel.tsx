'use client'

import { useActionState, useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'
import { addFamilyMember } from '@/actions/family'
import { Button } from '@/components/ui'

// ─── Types ───────────────────────────────────────────────────────────

interface AddMemberPanelProps {
  open: boolean
  onClose: () => void
}

const RELATIONSHIP_OPTIONS = [
  { value: 'spouse', label: 'Spouse' },
  { value: 'child', label: 'Child' },
  { value: 'parent', label: 'Parent' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'other', label: 'Other' },
] as const

// ─── Component ───────────────────────────────────────────────────────

export function AddMemberPanel({ open, onClose }: AddMemberPanelProps) {
  const [state, formAction, isPending] = useActionState(addFamilyMember, {
    success: false,
    message: '',
  })
  const formRef = useRef<HTMLFormElement>(null)
  const hasTriggeredSuccess = useRef(false)

  // Close + reset on success
  useEffect(() => {
    if (state.success && !hasTriggeredSuccess.current) {
      hasTriggeredSuccess.current = true
      formRef.current?.reset()
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
        aria-label="Add family member"
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-[520px] max-w-[90vw] flex-col bg-cream-50 shadow-[-8px_0_30px_rgba(0,0,0,0.12)] transition-transform duration-350',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
        style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-wood-800/10 px-6 py-5">
          <h3 className="font-heading text-lg font-semibold text-wood-900">Add Family Member</h3>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-wood-800/15 bg-white text-wood-800/60 transition-colors hover:bg-cream-100 hover:text-wood-900"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <form ref={formRef} action={formAction} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex-1 px-6 py-6">
            {/* Error message */}
            {state.message && !state.success && (
              <div
                className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3"
                role="alert"
              >
                <p className="text-sm text-red-600">{state.message}</p>
              </div>
            )}

            {/* Full Name */}
            <div className="mb-5">
              <label
                htmlFor="add-member-name"
                className="mb-1.5 block text-sm font-medium text-wood-900"
              >
                Full Name
              </label>
              <input
                id="add-member-name"
                name="full_name"
                type="text"
                required
                placeholder="e.g. David Nijo"
                className="w-full rounded-lg border border-wood-800/15 bg-white px-3.5 py-2.5 text-sm text-wood-900 placeholder:text-wood-800/30 focus:border-burgundy-700 focus:outline-none focus:ring-1 focus:ring-burgundy-700"
              />
              {state.errors?.full_name && (
                <p className="mt-1 text-xs text-red-600">{state.errors.full_name[0]}</p>
              )}
            </div>

            {/* Relationship */}
            <div className="mb-5">
              <label
                htmlFor="add-member-relationship"
                className="mb-1.5 block text-sm font-medium text-wood-900"
              >
                Relationship
              </label>
              <select
                id="add-member-relationship"
                name="relationship"
                required
                defaultValue=""
                className="w-full rounded-lg border border-wood-800/15 bg-white px-3.5 py-2.5 text-sm text-wood-900 focus:border-burgundy-700 focus:outline-none focus:ring-1 focus:ring-burgundy-700"
              >
                <option value="" disabled>
                  Select...
                </option>
                {RELATIONSHIP_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {state.errors?.relationship && (
                <p className="mt-1 text-xs text-red-600">{state.errors.relationship[0]}</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t border-wood-800/10 px-6 py-4">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isPending}>
              {isPending ? 'Adding...' : 'Add Member'}
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
