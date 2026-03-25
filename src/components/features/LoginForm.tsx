'use client'

import { useActionState } from 'react'

import { login } from '@/actions/login'
import { Button } from '@/components/ui'

interface LoginFormProps {
  redirectTo?: string
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(login, {
    success: false,
    message: '',
  })

  return (
    <form action={formAction} className="space-y-5">
      {redirectTo && (
        <input type="hidden" name="redirectTo" value={redirectTo} />
      )}

      {state.message && !state.errors && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {state.message}
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium text-wood-800">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="block w-full rounded-lg border border-wood-800/20 bg-cream-50 px-4 py-3 text-wood-800 placeholder:text-wood-800/40 focus:border-burgundy-700 focus:outline-none focus:ring-2 focus:ring-burgundy-700/20"
          placeholder="you@example.com"
        />
        {state.errors?.email && (
          <p className="text-sm text-red-600">{state.errors.email[0]}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium text-wood-800">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="block w-full rounded-lg border border-wood-800/20 bg-cream-50 px-4 py-3 text-wood-800 placeholder:text-wood-800/40 focus:border-burgundy-700 focus:outline-none focus:ring-2 focus:ring-burgundy-700/20"
          placeholder="Enter your password"
        />
        {state.errors?.password && (
          <p className="text-sm text-red-600">{state.errors.password[0]}</p>
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
            Signing in...
          </span>
        ) : (
          'Sign in'
        )}
      </Button>
    </form>
  )
}
