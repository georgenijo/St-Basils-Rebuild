'use client'

import { useActionState, useEffect } from 'react'

import { inviteUser } from '@/actions/users'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'

const ROLES = [
  { value: 'member', label: 'Member' },
  { value: 'admin', label: 'Admin' },
] as const

const inputBase =
  'w-full rounded-lg border bg-cream-50 px-4 py-3 font-body text-base text-wood-800 placeholder:text-wood-800/40 transition-colors focus:border-burgundy-700 focus:outline-none focus:ring-2 focus:ring-burgundy-700/20'

const initialState = {
  success: false,
  message: '',
  errors: undefined as Record<string, string[]> | undefined,
}

function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null
  return (
    <p id={id} className="mt-1.5 font-body text-sm text-red-600" role="alert">
      {errors[0]}
    </p>
  )
}

export function InviteUserForm() {
  const [state, formAction, isPending] = useActionState(inviteUser, initialState)

  // Redirect on success
  useEffect(() => {
    if (state.success) {
      window.location.href = '/admin/users'
    }
  }, [state.success])

  return (
    <form action={formAction} className="space-y-6">
      {/* Server error message */}
      {!state.success && state.message && !state.errors && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3" role="alert">
          <p className="font-body text-sm text-red-600">{state.message}</p>
        </div>
      )}

      {/* Email */}
      <div>
        <label htmlFor="email" className="mb-1.5 block font-body text-sm font-medium text-wood-900">
          Email <span className="text-burgundy-700">*</span>
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          placeholder="e.g. john@example.com"
          aria-invalid={Boolean(state.errors?.email)}
          aria-describedby={state.errors?.email ? 'email-error' : undefined}
          className={cn(inputBase, state.errors?.email && 'border-red-400')}
        />
        <FieldError id="email-error" errors={state.errors?.email} />
      </div>

      {/* Full Name */}
      <div>
        <label
          htmlFor="full_name"
          className="mb-1.5 block font-body text-sm font-medium text-wood-900"
        >
          Full Name <span className="text-burgundy-700">*</span>
        </label>
        <input
          type="text"
          id="full_name"
          name="full_name"
          required
          maxLength={200}
          placeholder="e.g. John Thomas"
          aria-invalid={Boolean(state.errors?.full_name)}
          aria-describedby={state.errors?.full_name ? 'full-name-error' : undefined}
          className={cn(inputBase, state.errors?.full_name && 'border-red-400')}
        />
        <FieldError id="full-name-error" errors={state.errors?.full_name} />
      </div>

      {/* Role */}
      <div>
        <label htmlFor="role" className="mb-1.5 block font-body text-sm font-medium text-wood-900">
          Role
        </label>
        <select
          id="role"
          name="role"
          defaultValue="member"
          aria-invalid={Boolean(state.errors?.role)}
          aria-describedby={state.errors?.role ? 'role-error' : undefined}
          className={cn(inputBase, state.errors?.role && 'border-red-400')}
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <FieldError id="role-error" errors={state.errors?.role} />
      </div>

      {/* Submit / Cancel */}
      <div className="flex items-center gap-4 border-t border-wood-800/10 pt-6">
        <Button type="submit" disabled={isPending}>
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
              Sending Invite...
            </span>
          ) : (
            'Send Invite'
          )}
        </Button>
        <Button variant="ghost" href="/admin/users">
          Cancel
        </Button>
      </div>
    </form>
  )
}
