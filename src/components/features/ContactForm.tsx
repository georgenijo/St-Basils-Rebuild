'use client'

import { useActionState, useRef, useEffect } from 'react'
import type { TurnstileInstance } from '@marsidev/react-turnstile'

import { submitContact } from '@/actions/contact'
import { CaptchaField } from '@/components/features/CaptchaField'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'

const initialState = {
  success: false,
  message: '',
  errors: undefined as Record<string, string[]> | undefined,
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null
  return (
    <p className="mt-1.5 font-body text-sm text-red-600" role="alert">
      {errors[0]}
    </p>
  )
}

export function ContactForm() {
  const [state, action, isPending] = useActionState(submitContact, initialState)
  const formRef = useRef<HTMLFormElement>(null)
  const turnstileRef = useRef<TurnstileInstance>(null)

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset()
      turnstileRef.current?.reset()
    }
  }, [state])

  if (state.success) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center" role="status" aria-live="polite">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-6 w-6 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h3 className="font-heading text-xl font-semibold text-wood-900">Message Sent</h3>
        <p className="mt-2 font-body text-base text-wood-800/80">{state.message}</p>
      </div>
    )
  }

  const inputBase =
    'w-full rounded-lg border bg-cream-50 px-4 py-3 font-body text-base text-wood-800 placeholder:text-wood-800/40 transition-colors focus-visible:border-burgundy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-700 focus-visible:ring-offset-2'

  return (
    <form ref={formRef} action={action} className="space-y-6">
      {/* Honeypot — hidden from real users */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input type="text" id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {/* Server error message */}
      {!state.success && state.message && !state.errors && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3" role="alert">
          <p className="font-body text-sm text-red-600">{state.message}</p>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="mb-1.5 block font-body text-sm font-medium text-wood-900">
            Name <span className="text-burgundy-700">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            maxLength={100}
            placeholder="Your full name"
            className={cn(inputBase, state.errors?.name && 'border-red-400')}
          />
          <FieldError errors={state.errors?.name} />
        </div>

        <div>
          <label htmlFor="email" className="mb-1.5 block font-body text-sm font-medium text-wood-900">
            Email <span className="text-burgundy-700">*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            placeholder="your@email.com"
            className={cn(inputBase, state.errors?.email && 'border-red-400')}
          />
          <FieldError errors={state.errors?.email} />
        </div>
      </div>

      <div>
        <label htmlFor="subject" className="mb-1.5 block font-body text-sm font-medium text-wood-900">
          Subject <span className="text-burgundy-700">*</span>
        </label>
        <input
          type="text"
          id="subject"
          name="subject"
          required
          maxLength={200}
          placeholder="What is this regarding?"
          className={cn(inputBase, state.errors?.subject && 'border-red-400')}
        />
        <FieldError errors={state.errors?.subject} />
      </div>

      <div>
        <label htmlFor="message" className="mb-1.5 block font-body text-sm font-medium text-wood-900">
          Message <span className="text-burgundy-700">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={6}
          maxLength={5000}
          placeholder="How can we help you?"
          className={cn(inputBase, 'resize-y', state.errors?.message && 'border-red-400')}
        />
        <FieldError errors={state.errors?.message} />
      </div>

      <CaptchaField turnstileRef={turnstileRef} theme="light" />

      <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
        {isPending ? (
          <span className="flex items-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Sending...
          </span>
        ) : (
          'Send Message'
        )}
      </Button>
    </form>
  )
}
