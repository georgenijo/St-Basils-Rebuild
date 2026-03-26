'use client'

import { useActionState, useRef, useEffect } from 'react'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'

import { subscribeNewsletter } from '@/actions/newsletter'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'

export interface NewsletterSignupFormProps {
  variant?: 'light' | 'dark'
  className?: string
}

const initialState = {
  success: false,
  message: '',
  errors: undefined as Record<string, string[]> | undefined,
}

export function NewsletterSignupForm({
  variant = 'dark',
  className,
}: NewsletterSignupFormProps) {
  const [state, action, isPending] = useActionState(subscribeNewsletter, initialState)
  const formRef = useRef<HTMLFormElement>(null)
  const turnstileRef = useRef<TurnstileInstance>(null)

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset()
      turnstileRef.current?.reset()
    }
  }, [state])

  const isDark = variant === 'dark'

  if (state.success) {
    return (
      <div className={cn('rounded-2xl p-6 text-center', isDark ? 'bg-cream-50/10' : 'border border-green-200 bg-green-50', className)}>
        <div className={cn(
          'mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full',
          isDark ? 'bg-cream-50/20' : 'bg-green-100'
        )}>
          <svg
            className={cn('h-5 w-5', isDark ? 'text-cream-50' : 'text-green-600')}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <p className={cn(
          'font-body text-sm',
          isDark ? 'text-cream-50/90' : 'text-wood-800'
        )}>
          {state.message}
        </p>
      </div>
    )
  }

  return (
    <form ref={formRef} action={action} className={cn('space-y-3', className)}>
      {/* Honeypot — hidden from real users */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="newsletter-website">Website</label>
        <input type="text" id="newsletter-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {/* Error message */}
      {!state.success && state.message && !state.errors && (
        <div
          className={cn(
            'rounded-lg px-3 py-2',
            isDark ? 'bg-red-500/20 text-red-200' : 'border border-red-200 bg-red-50 text-red-600'
          )}
          role="alert"
        >
          <p className="font-body text-sm">{state.message}</p>
        </div>
      )}

      <div>
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <div className="flex gap-2">
          <input
            type="email"
            id="newsletter-email"
            name="email"
            required
            placeholder="Enter your email"
            aria-label="Email address for newsletter signup"
            className={cn(
              'min-w-0 flex-1 rounded-lg border px-4 py-2.5 font-body text-sm transition-colors focus:outline-none focus:ring-2',
              isDark
                ? 'border-cream-50/20 bg-cream-50/10 text-cream-50 placeholder:text-cream-50/40 focus:border-cream-50/40 focus:ring-cream-50/20'
                : 'border-wood-800/20 bg-cream-50 text-wood-800 placeholder:text-wood-800/40 focus:border-burgundy-700 focus:ring-burgundy-700/20',
              state.errors?.email && (isDark ? 'border-red-400/60' : 'border-red-400')
            )}
          />
          <Button
            type="submit"
            disabled={isPending}
            variant={isDark ? 'secondary' : 'primary'}
            size="sm"
            className={cn(
              'shrink-0',
              isDark && 'border-cream-50/40 text-cream-50 hover:bg-cream-50 hover:text-charcoal'
            )}
          >
            {isPending ? (
              <span className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Joining...
              </span>
            ) : (
              'Subscribe'
            )}
          </Button>
        </div>
        {state.errors?.email && (
          <p
            className={cn(
              'mt-1.5 font-body text-sm',
              isDark ? 'text-red-300' : 'text-red-600'
            )}
            role="alert"
          >
            {state.errors.email[0]}
          </p>
        )}
      </div>

      <Turnstile
        ref={turnstileRef}
        siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
        options={{ theme: isDark ? 'dark' : 'light', size: 'compact' }}
      />
    </form>
  )
}
