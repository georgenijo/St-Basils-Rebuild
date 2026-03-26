'use client'

import { useActionState, useState, useEffect, useRef } from 'react'

import { createEvent, updateEvent } from '@/actions/events'
import { Button } from '@/components/ui'
import { RRuleBuilder } from '@/components/features/RRuleBuilder'
import { TiptapEditor } from '@/components/features/TiptapEditor'
import {
  CHURCH_TIME_ZONE,
  formatIsoForDatetimeLocal,
  parseRRuleUntilToDateInput,
} from '@/lib/event-time'
import { slugify } from '@/lib/validators/event'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  { value: 'liturgical', label: 'Liturgical' },
  { value: 'community', label: 'Community' },
  { value: 'special', label: 'Special' },
] as const

const inputBase =
  'w-full rounded-lg border bg-cream-50 px-4 py-3 font-body text-base text-wood-800 placeholder:text-wood-800/40 transition-colors focus:border-burgundy-700 focus:outline-none focus:ring-2 focus:ring-burgundy-700/20'

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

interface EventData {
  id: string
  title: string
  slug: string
  description: unknown
  location: string | null
  start_at: string
  end_at: string | null
  is_recurring: boolean
  category: string
  recurrence_rules?: Array<{
    rrule_string: string
  }>
}

interface EventFormProps {
  event?: EventData
}

export function EventForm({ event }: EventFormProps) {
  const isEditing = !!event
  const action = isEditing ? updateEvent : createEvent
  const [state, formAction, isPending] = useActionState(action, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  // Form field state
  const [title, setTitle] = useState(event?.title ?? '')
  const [slug, setSlug] = useState(event?.slug ?? '')
  const [slugManual, setSlugManual] = useState(isEditing)
  const [description, setDescription] = useState(
    event?.description ? JSON.stringify(event.description) : ''
  )
  const [isRecurring, setIsRecurring] = useState(event?.is_recurring ?? false)

  // RRULE state
  const existingRRule = event?.recurrence_rules?.[0]?.rrule_string
  const [rruleFrequency, setRruleFrequency] = useState('')
  const [rruleByDay, setRruleByDay] = useState<string[]>([])
  const [rruleUntil, setRruleUntil] = useState('')
  const [rruleCount, setRruleCount] = useState('')

  // Parse existing RRULE on mount
  useEffect(() => {
    if (existingRRule) {
      const parts = existingRRule.split(';')
      const map: Record<string, string> = {}
      for (const part of parts) {
        const [key, value] = part.split('=')
        map[key] = value
      }
      setRruleFrequency(map.FREQ || '')
      setRruleByDay(map.BYDAY ? map.BYDAY.split(',') : [])
      if (map.UNTIL) {
        setRruleUntil(parseRRuleUntilToDateInput(map.UNTIL))
      }
      if (map.COUNT) setRruleCount(map.COUNT)
    }
  }, [existingRRule])

  // Auto-generate slug from title
  useEffect(() => {
    if (!slugManual && title) {
      setSlug(slugify(title))
    }
  }, [title, slugManual])

  // Redirect on success
  useEffect(() => {
    if (state.success) {
      window.location.href = '/admin/events'
    }
  }, [state.success])
  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {isEditing && (
        <input type="hidden" name="event_id" value={event.id} />
      )}

      {/* Server error message */}
      {!state.success && state.message && !state.errors && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3"
          role="alert"
        >
          <p className="font-body text-sm text-red-600">{state.message}</p>
        </div>
      )}

      {/* Title */}
      <div>
        <label
          htmlFor="title"
          className="mb-1.5 block font-body text-sm font-medium text-wood-900"
        >
          Title <span className="text-burgundy-700">*</span>
        </label>
        <input
          type="text"
          id="title"
          name="title"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Sunday Holy Qurbono"
          className={cn(inputBase, state.errors?.title && 'border-red-400')}
        />
        <FieldError errors={state.errors?.title} />
      </div>

      {/* Slug */}
      <div>
        <label
          htmlFor="slug"
          className="mb-1.5 block font-body text-sm font-medium text-wood-900"
        >
          Slug <span className="text-burgundy-700">*</span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            id="slug"
            name="slug"
            required
            maxLength={200}
            value={slug}
            onChange={(e) => {
              setSlugManual(true)
              setSlug(e.target.value)
            }}
            placeholder="sunday-holy-qurbono"
            className={cn(
              inputBase,
              'font-mono text-sm',
              state.errors?.slug && 'border-red-400'
            )}
          />
          {slugManual && (
            <button
              type="button"
              onClick={() => {
                setSlugManual(false)
                setSlug(slugify(title))
              }}
              className="shrink-0 rounded-lg border border-wood-800/20 px-3 py-2 font-body text-xs text-wood-800/60 transition-colors hover:bg-cream-100"
            >
              Auto
            </button>
          )}
        </div>
        <FieldError errors={state.errors?.slug} />
      </div>

      {/* Category */}
      <div>
        <label
          htmlFor="category"
          className="mb-1.5 block font-body text-sm font-medium text-wood-900"
        >
          Category <span className="text-burgundy-700">*</span>
        </label>
        <select
          id="category"
          name="category"
          defaultValue={event?.category ?? 'community'}
          className={cn(inputBase, state.errors?.category && 'border-red-400')}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <FieldError errors={state.errors?.category} />
      </div>

      {/* Description (Tiptap) */}
      <div>
        <p id="description-label" className="mb-1.5 font-body text-sm font-medium text-wood-900">
          Description
        </p>
        <div aria-labelledby="description-label">
          <TiptapEditor
            content={description}
            onChange={setDescription}
            error={!!state.errors?.description}
          />
        </div>
        <input type="hidden" name="description" value={description} />
        <FieldError errors={state.errors?.description} />
      </div>

      {/* Location */}
      <div>
        <label
          htmlFor="location"
          className="mb-1.5 block font-body text-sm font-medium text-wood-900"
        >
          Location
        </label>
        <input
          type="text"
          id="location"
          name="location"
          maxLength={500}
          defaultValue={event?.location ?? ''}
          placeholder="e.g. 73 Ellis Street, Newton, MA 02464"
          className={cn(inputBase, state.errors?.location && 'border-red-400')}
        />
        <FieldError errors={state.errors?.location} />
      </div>

      {/* Start / End dates */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label
            htmlFor="start_at"
            className="mb-1.5 block font-body text-sm font-medium text-wood-900"
          >
            Start <span className="text-burgundy-700">*</span>
          </label>
          <input
            type="datetime-local"
            id="start_at"
            name="start_at"
            required
            defaultValue={formatIsoForDatetimeLocal(event?.start_at)}
            className={cn(
              inputBase,
              state.errors?.start_at && 'border-red-400'
            )}
          />
          <FieldError errors={state.errors?.start_at} />
        </div>
        <div>
          <label
            htmlFor="end_at"
            className="mb-1.5 block font-body text-sm font-medium text-wood-900"
          >
            End
          </label>
          <input
            type="datetime-local"
            id="end_at"
            name="end_at"
            defaultValue={formatIsoForDatetimeLocal(event?.end_at)}
            className={cn(
              inputBase,
              state.errors?.end_at && 'border-red-400'
            )}
          />
          <FieldError errors={state.errors?.end_at} />
        </div>
      </div>
      <p className="text-sm text-wood-800/60">
        Event times are entered and displayed in Eastern Time ({CHURCH_TIME_ZONE}).
      </p>

      {/* Recurring toggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={isRecurring}
          aria-label="Recurring event"
          onClick={() => setIsRecurring(!isRecurring)}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-700 focus-visible:ring-offset-2',
            isRecurring ? 'bg-burgundy-700' : 'bg-wood-800/20'
          )}
        >
          <span
            className={cn(
              'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
              isRecurring ? 'translate-x-5' : 'translate-x-0'
            )}
          />
        </button>
        <span className="font-body text-sm font-medium text-wood-900">
          Recurring event
        </span>
        <input
          type="hidden"
          name="is_recurring"
          value={isRecurring ? 'true' : 'false'}
        />
      </div>

      {/* RRULE Builder */}
      {isRecurring && (
        <RRuleBuilder
          frequency={rruleFrequency}
          byDay={rruleByDay}
          until={rruleUntil}
          count={rruleCount}
          onFrequencyChange={setRruleFrequency}
          onByDayChange={setRruleByDay}
          onUntilChange={setRruleUntil}
          onCountChange={setRruleCount}
          errors={state.errors}
        />
      )}

      {/* Submit */}
      <div className="flex items-center gap-4 border-t border-wood-800/10 pt-6">
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <span className="flex items-center gap-2">
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
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
              Saving...
            </span>
          ) : isEditing ? (
            'Update Event'
          ) : (
            'Create Event'
          )}
        </Button>
        <Button type="button" variant="ghost" href="/admin/events">
          Cancel
        </Button>
      </div>
    </form>
  )
}
