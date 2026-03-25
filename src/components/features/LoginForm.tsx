'use client'

import { useActionState } from 'react'

import { login } from '@/actions/login'

interface LoginFormProps {
  redirectTo?: string
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(login, {
    success: false,
    message: '',
  })

  return (
    <form action={formAction} className="mt-8 space-y-5">
      {redirectTo && (
        <input type="hidden" name="redirectTo" value={redirectTo} />
      )}

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-wood-800"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 block w-full rounded-lg border border-wood-800/20 bg-cream-50 px-4 py-2.5 text-wood-800 placeholder:text-wood-800/40 focus:border-burgundy-700 focus:outline-none focus:ring-1 focus:ring-burgundy-700"
        />
        {state.errors?.email && (
          <p className="mt-1 text-sm text-red-600">{state.errors.email[0]}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-wood-800"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 block w-full rounded-lg border border-wood-800/20 bg-cream-50 px-4 py-2.5 text-wood-800 placeholder:text-wood-800/40 focus:border-burgundy-700 focus:outline-none focus:ring-1 focus:ring-burgundy-700"
        />
        {state.errors?.password && (
          <p className="mt-1 text-sm text-red-600">
            {state.errors.password[0]}
          </p>
        )}
      </div>

      {state.message && !state.success && (
        <p role="alert" className="text-sm text-red-600">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-burgundy-700 px-6 py-3 font-medium text-cream-50 transition-colors hover:bg-burgundy-800 disabled:opacity-50"
      >
        {pending ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  )
}
