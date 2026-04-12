'use client'

import { useActionState, useRef, useEffect, useState } from 'react'
import type { TurnstileInstance } from '@marsidev/react-turnstile'

import { submitRsvp } from '@/actions/rsvp'
import { CaptchaField } from '@/components/features/CaptchaField'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'

import type { RsvpSettings } from '@/lib/validators/rsvp'

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

interface RsvpFormProps {
  slug: string
  settings: RsvpSettings
  userName?: string
}

const inputBase =
  'w-full rounded-lg border bg-cream-50 px-4 py-3 font-body text-base text-wood-800 placeholder:text-wood-800/40 transition-colors focus-visible:border-burgundy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-700 focus-visible:ring-offset-2'

export function RsvpForm({ slug, settings, userName }: RsvpFormProps) {
  const [state, action, isPending] = useActionState(submitRsvp, initialState)
  const formRef = useRef<HTMLFormElement>(null)
  const turnstileRef = useRef<TurnstileInstance>(null)
  const [headcount, setHeadcount] = useState(1)

  useEffect(() => {
    if (state.success) {
      turnstileRef.current?.reset()
    }
  }, [state])

  if (state.success) {
    return (
      <div
        className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center"
        role="status"
        aria-live="polite"
      >
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
        <h3 className="font-heading text-xl font-semibold text-wood-900">You&apos;re In!</h3>
        <p className="mt-2 font-body text-base text-wood-800/80">{state.message}</p>
      </div>
    )
  }

  return (
    <form ref={formRef} action={action} className="space-y-6">
      <input type="hidden" name="slug" value={slug} />

      {/* Server error message */}
      {!state.success && state.message && !state.errors && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3" role="alert">
          <p className="font-body text-sm text-red-600">{state.message}</p>
        </div>
      )}

      {/* Name */}
      <div>
        <label
          htmlFor="rsvp-name"
          className="mb-1.5 block font-body text-sm font-medium text-wood-900"
        >
          Your Name <span className="text-burgundy-700">*</span>
        </label>
        <input
          type="text"
          id="rsvp-name"
          name="name"
          required
          maxLength={100}
          defaultValue={userName}
          placeholder="Your full name"
          className={cn(inputBase, state.errors?.name && 'border-red-400')}
        />
        <FieldError errors={state.errors?.name} />
      </div>

      {/* Headcount */}
      <div>
        <p className="mb-1.5 font-body text-sm font-medium text-wood-900">
          How many people? <span className="text-burgundy-700">*</span>
        </p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Number of people">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={headcount === n}
              onClick={() => setHeadcount(n)}
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-lg border font-body text-base font-medium transition-colors',
                headcount === n
                  ? 'border-burgundy-700 bg-burgundy-700 text-cream-50'
                  : 'border-wood-800/20 bg-cream-50 text-wood-800 hover:border-burgundy-700/40'
              )}
            >
              {n === 5 ? '5+' : n}
            </button>
          ))}
        </div>
        {headcount === 5 && (
          <input
            type="number"
            min={5}
            max={20}
            defaultValue={5}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10)
              if (val >= 5 && val <= 20) setHeadcount(val)
            }}
            className={cn(inputBase, 'mt-2 w-24')}
            aria-label="Exact number of people (5 or more)"
          />
        )}
        <input type="hidden" name="headcount" value={headcount} />
        <FieldError errors={state.errors?.headcount} />
      </div>

      {/* Children count (conditional) */}
      {settings.children_count && (
        <div>
          <label
            htmlFor="rsvp-children"
            className="mb-1.5 block font-body text-sm font-medium text-wood-900"
          >
            How many children?
          </label>
          <input
            type="number"
            id="rsvp-children"
            name="children_count"
            min={0}
            max={50}
            placeholder="0"
            className={cn(inputBase, 'w-24', state.errors?.children_count && 'border-red-400')}
          />
          <FieldError errors={state.errors?.children_count} />
        </div>
      )}

      {/* Dietary needs (conditional) */}
      {settings.dietary && (
        <div>
          <label
            htmlFor="rsvp-dietary"
            className="mb-1.5 block font-body text-sm font-medium text-wood-900"
          >
            Dietary needs or allergies
          </label>
          <input
            type="text"
            id="rsvp-dietary"
            name="dietary"
            maxLength={500}
            placeholder="e.g. vegetarian, nut allergy"
            className={cn(inputBase, state.errors?.dietary && 'border-red-400')}
          />
          <FieldError errors={state.errors?.dietary} />
        </div>
      )}

      {/* Bringing something (conditional) */}
      {settings.bringing && (
        <div>
          <label
            htmlFor="rsvp-bringing"
            className="mb-1.5 block font-body text-sm font-medium text-wood-900"
          >
            Bringing something?
          </label>
          <input
            type="text"
            id="rsvp-bringing"
            name="bringing"
            maxLength={500}
            placeholder="e.g. salad, dessert"
            className={cn(inputBase, state.errors?.bringing && 'border-red-400')}
          />
          <FieldError errors={state.errors?.bringing} />
        </div>
      )}

      {/* Notes (conditional) */}
      {settings.notes && (
        <div>
          <label
            htmlFor="rsvp-notes"
            className="mb-1.5 block font-body text-sm font-medium text-wood-900"
          >
            Notes
          </label>
          <textarea
            id="rsvp-notes"
            name="notes"
            rows={3}
            maxLength={1000}
            placeholder="Anything else we should know?"
            className={cn(inputBase, 'resize-y', state.errors?.notes && 'border-red-400')}
          />
          <FieldError errors={state.errors?.notes} />
        </div>
      )}

      <CaptchaField turnstileRef={turnstileRef} theme="light" />

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
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
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Sending...
          </span>
        ) : (
          'Count me in'
        )}
      </Button>
    </form>
  )
}
