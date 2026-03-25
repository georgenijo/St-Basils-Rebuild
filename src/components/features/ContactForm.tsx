'use client'

import { useActionState, useRef } from 'react'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'

import { submitContactForm } from '@/actions/contact'
import { Button } from '@/components/ui'

const inputClassName =
  'block w-full rounded-lg border border-wood-800/20 bg-cream-50 px-4 py-3 text-wood-800 placeholder:text-wood-800/40 focus:border-burgundy-700 focus:outline-none focus:ring-2 focus:ring-burgundy-700/20'

export function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContactForm, {
    success: false,
    message: '',
  })
  const formRef = useRef<HTMLFormElement>(null)
  const turnstileRef = useRef<TurnstileInstance>(null)

  return (
    <>
      {state.success && state.message ? (
        <div
          role="status"
          className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center"
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6 text-green-600"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h3 className="font-heading text-xl font-semibold text-wood-900">Message Sent</h3>
          <p className="mt-2 font-body text-wood-800/80">{state.message}</p>
        </div>
      ) : (
        <form ref={formRef} action={formAction} className="space-y-6">
          {state.message && !state.success && !state.errors && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {state.message}
            </div>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Name */}
            <div className="space-y-1.5">
              <label htmlFor="contact-name" className="block text-sm font-medium text-wood-800">
                Name
              </label>
              <input
                id="contact-name"
                name="name"
                type="text"
                autoComplete="name"
                required
                className={inputClassName}
                placeholder="Your full name"
              />
              {state.errors?.name && (
                <p className="text-sm text-red-600">{state.errors.name[0]}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="contact-email" className="block text-sm font-medium text-wood-800">
                Email
              </label>
              <input
                id="contact-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className={inputClassName}
                placeholder="you@example.com"
              />
              {state.errors?.email && (
                <p className="text-sm text-red-600">{state.errors.email[0]}</p>
              )}
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <label htmlFor="contact-subject" className="block text-sm font-medium text-wood-800">
              Subject
            </label>
            <input
              id="contact-subject"
              name="subject"
              type="text"
              required
              className={inputClassName}
              placeholder="How can we help?"
            />
            {state.errors?.subject && (
              <p className="text-sm text-red-600">{state.errors.subject[0]}</p>
            )}
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <label htmlFor="contact-message" className="block text-sm font-medium text-wood-800">
              Message
            </label>
            <textarea
              id="contact-message"
              name="message"
              rows={6}
              required
              className={inputClassName}
              placeholder="Tell us more about your inquiry..."
            />
            {state.errors?.message && (
              <p className="text-sm text-red-600">{state.errors.message[0]}</p>
            )}
          </div>

          {/* Honeypot — hidden from users, visible to bots */}
          <div className="absolute -left-[9999px]" aria-hidden="true">
            <label htmlFor="contact-website">Website</label>
            <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
          </div>

          {/* Turnstile */}
          <Turnstile
            ref={turnstileRef}
            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''}
            options={{ theme: 'light', size: 'normal' }}
          />

          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
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
                Sending...
              </span>
            ) : (
              'Send Message'
            )}
          </Button>
        </form>
      )}
    </>
  )
}
