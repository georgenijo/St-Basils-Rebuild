'use client'

import { useActionState, useEffect, useRef } from 'react'

import { Button } from '@/components/ui'

const initialState = {
  success: false,
  message: '',
}

interface UserActionDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  title: string
  description: string
  action: (
    state: { success: boolean; message: string },
    formData: FormData
  ) => Promise<{ success: boolean; message: string }>
  hiddenFields: Record<string, string>
  confirmLabel: string
  confirmClassName?: string
}

export function UserActionDialog({
  open,
  onClose,
  onSuccess,
  title,
  description,
  action,
  hiddenFields,
  confirmLabel,
  confirmClassName = 'bg-burgundy-700 text-cream-50 hover:bg-burgundy-800',
}: UserActionDialogProps) {
  const [state, formAction, isPending] = useActionState(action, initialState)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal()
    } else {
      dialogRef.current?.close()
    }
  }, [open])

  useEffect(() => {
    if (state.success) {
      onClose()
      onSuccess()
    }
  }, [state.success, onClose, onSuccess])

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="m-auto w-full max-w-md rounded-2xl border border-wood-800/10 bg-cream-50 p-0 shadow-lg backdrop:bg-charcoal/50"
    >
      <div className="p-6">
        <h2 className="font-heading text-xl font-semibold text-wood-900">{title}</h2>
        <p className="mt-2 font-body text-sm text-wood-800/80">{description}</p>

        {state.message && !state.success && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3" role="alert">
            <p className="font-body text-sm text-red-600">{state.message}</p>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <form action={formAction}>
            {Object.entries(hiddenFields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <button
              type="submit"
              disabled={isPending}
              className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-700 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${confirmClassName}`}
            >
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
                  Processing...
                </span>
              ) : (
                confirmLabel
              )}
            </button>
          </form>
        </div>
      </div>
    </dialog>
  )
}
