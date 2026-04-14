'use client'

import { useActionState } from 'react'

import { setPassword } from '@/actions/set-password'
import { Button } from '@/components/ui'

export function SetPasswordForm({ flow = null }: { flow?: 'invite' | 'recovery' | null }) {
  const [state, formAction, pending] = useActionState(setPassword, {
    success: false,
    message: '',
  })

  return (
    <form action={formAction} className="space-y-5">
      {flow && <input type="hidden" name="flow" value={flow} />}
      <p className="text-sm text-wood-800/70">Create a password to complete your account setup.</p>

      {state.message && !state.errors && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {state.message}
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium text-wood-800">
          New Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="block w-full rounded-lg border border-wood-800/20 bg-cream-50 px-4 py-3 text-wood-800 placeholder:text-wood-800/40 focus-visible:border-burgundy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-700 focus-visible:ring-offset-2"
          placeholder="At least 8 characters"
        />
        {state.errors?.password && (
          <p className="text-sm text-red-600">{state.errors.password[0]}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-wood-800">
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          className="block w-full rounded-lg border border-wood-800/20 bg-cream-50 px-4 py-3 text-wood-800 placeholder:text-wood-800/40 focus-visible:border-burgundy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-700 focus-visible:ring-offset-2"
          placeholder="Re-enter your password"
        />
        {state.errors?.confirmPassword && (
          <p className="text-sm text-red-600">{state.errors.confirmPassword[0]}</p>
        )}
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? (
          <span className="inline-flex items-center gap-2">
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
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
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Setting password...
          </span>
        ) : (
          'Set Password'
        )}
      </Button>
    </form>
  )
}
