'use server'

import { revalidatePath } from 'next/cache'
import { rrulestr } from 'rrule'

import { sendEmail } from '@/lib/email'
import { formatInChurchTimeZone, parseDatetimeLocalInTimeZone } from '@/lib/event-time'
import { createClient } from '@/lib/supabase/server'
import {
  eventInstanceSchema,
  cancelInstanceSchema,
  restoreInstanceSchema,
} from '@/lib/validators/event'
import {
  EventChangeNotification,
  type EventChangeType,
} from '@/emails/event-change-notification'

type ActionState = {
  success: boolean
  message: string
  errors?: Record<string, string[]>
}

const FROM_ADDRESS = "St. Basil's Church <noreply@stbasilsboston.org>"
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://stbasilsboston.org'

const dateFormat: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
}

const timeFormat: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
}

const dateTimeFormat: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
}

async function sendOccurrenceNotification(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  originalDate: string,
  changeType: EventChangeType,
  details: {
    reason?: string
    note?: string
    newStartAt?: string | null
    newEndAt?: string | null
    newLocation?: string | null
  }
): Promise<void> {
  try {
    const [{ data: event }, { data: subscribers }] = await Promise.all([
      supabase
        .from('events')
        .select('title, start_at, end_at, location, recurrence_rules(rrule_string, dtstart)')
        .eq('id', eventId)
        .single(),
      supabase
        .from('email_subscribers')
        .select('email, unsubscribe_token')
        .eq('confirmed', true)
        .is('unsubscribed_at', null),
    ])

    if (!event || !subscribers || subscribers.length === 0) return

    const eventDate = formatInChurchTimeZone(originalDate, dateFormat)
    const eventTime = formatInChurchTimeZone(
      details.newStartAt || event.start_at,
      timeFormat
    )

    // Build change list for modified occurrences
    const changes: string[] = []
    if (changeType === 'modified') {
      if (details.newStartAt) {
        const oldTime = formatInChurchTimeZone(event.start_at, timeFormat)
        const newTime = formatInChurchTimeZone(details.newStartAt, timeFormat)
        if (oldTime !== newTime) {
          changes.push(`Start time: ${oldTime} \u2192 ${newTime}`)
        }
      }
      if (details.newEndAt && event.end_at) {
        const oldEnd = formatInChurchTimeZone(event.end_at, timeFormat)
        const newEnd = formatInChurchTimeZone(details.newEndAt, timeFormat)
        if (oldEnd !== newEnd) {
          changes.push(`End time: ${oldEnd} \u2192 ${newEnd}`)
        }
      }
      if (details.newLocation && details.newLocation !== event.location) {
        changes.push(`Location: ${event.location || 'TBD'} \u2192 ${details.newLocation}`)
      }
    }

    // Compute next occurrence for cancellations
    let nextOccurrence: string | undefined
    if (changeType === 'cancelled') {
      const rules = event.recurrence_rules as
        | { rrule_string: string; dtstart: string }[]
        | null
      if (rules && rules.length > 0) {
        try {
          const rule = rules[0]
          const rrule = rrulestr(rule.rrule_string, {
            dtstart: new Date(rule.dtstart),
          })
          const cancelledDate = new Date(originalDate)
          const next = rrule.after(cancelledDate, false)
          if (next) {
            nextOccurrence = formatInChurchTimeZone(next.toISOString(), dateTimeFormat)
          }
        } catch (e) {
          console.error('[sendOccurrenceNotification] RRULE parse error:', e)
        }
      }
    }

    // Build subject line
    const subjectMap: Record<EventChangeType, string> = {
      cancelled: `\u26A0\uFE0F ${event.title} on ${eventDate} has been cancelled`,
      modified: `\uD83D\uDCC5 ${event.title} on ${eventDate} \u2014 schedule change`,
      restored: `\u2705 ${event.title} on ${eventDate} is back on`,
    }
    const subject = subjectMap[changeType]

    // Original event time for cancelled/restored templates
    const originalEventTime = formatInChurchTimeZone(event.start_at, timeFormat)

    for (const sub of subscribers) {
      try {
        await sendEmail({
          from: FROM_ADDRESS,
          to: sub.email,
          subject,
          react: EventChangeNotification({
            changeType,
            eventTitle: event.title,
            eventDate,
            eventTime: changeType === 'modified' ? eventTime : originalEventTime,
            changes: changes.length > 0 ? changes : undefined,
            reason: details.reason,
            nextOccurrence,
            note: details.note,
            unsubscribeToken: sub.unsubscribe_token,
            siteUrl: SITE_URL,
          }),
          metadata: {
            template: 'event-change-notification',
            eventId,
            changeType,
          },
        })
      } catch (e) {
        console.error('[sendOccurrenceNotification] Email failed for', sub.email, e)
      }
    }
  } catch (error) {
    console.error('[sendOccurrenceNotification] Failed:', error)
  }
}

function revalidateEventPaths() {
  revalidatePath('/admin/events')
  revalidatePath('/admin/events/calendar')
  revalidatePath('/events')
}

export async function upsertEventInstance(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = eventInstanceSchema.safeParse({
    event_id: formData.get('event_id'),
    original_date: formData.get('original_date'),
    start_at: formData.get('start_at') ?? '',
    end_at: formData.get('end_at') ?? '',
    location: formData.get('location') ?? '',
    note: formData.get('note') ?? '',
    notify_subscribers: formData.get('notify_subscribers') ?? undefined,
  })

  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Unauthorized' }

  // original_date is already UTC — store directly, no timezone conversion
  const originalDate = parsed.data.original_date

  // start_at/end_at are in church timezone (datetime-local format) — convert to UTC
  const startAtOverride =
    parsed.data.start_at ? parseDatetimeLocalInTimeZone(parsed.data.start_at) : null
  const endAtOverride =
    parsed.data.end_at ? parseDatetimeLocalInTimeZone(parsed.data.end_at) : null

  if (parsed.data.start_at && !startAtOverride) {
    return {
      success: false,
      message: 'Validation failed',
      errors: { start_at: ['Start time is invalid.'] },
    }
  }

  if (parsed.data.end_at && !endAtOverride) {
    return {
      success: false,
      message: 'Validation failed',
      errors: { end_at: ['End time is invalid.'] },
    }
  }

  const { error } = await supabase.from('event_instances').upsert(
    {
      event_id: parsed.data.event_id,
      original_date: originalDate,
      is_cancelled: false,
      start_at_override: startAtOverride,
      end_at_override: endAtOverride,
      location_override: parsed.data.location || null,
      note: parsed.data.note || null,
      modified_by: user.id,
    },
    { onConflict: 'event_id,original_date' }
  )

  if (error) {
    console.error('[upsertEventInstance] DB error:', error.message)
    return { success: false, message: 'Failed to update occurrence' }
  }

  if (parsed.data.notify_subscribers === 'on') {
    await sendOccurrenceNotification(supabase, parsed.data.event_id, originalDate, 'modified', {
      note: parsed.data.note || undefined,
      newStartAt: startAtOverride,
      newEndAt: endAtOverride,
      newLocation: parsed.data.location || null,
    })
  }

  revalidateEventPaths()
  return { success: true, message: 'Occurrence updated successfully' }
}

export async function cancelEventInstance(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = cancelInstanceSchema.safeParse({
    event_id: formData.get('event_id'),
    original_date: formData.get('original_date'),
    note: formData.get('note') ?? '',
    notify_subscribers: formData.get('notify_subscribers') ?? undefined,
  })

  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Unauthorized' }

  const { error } = await supabase.from('event_instances').upsert(
    {
      event_id: parsed.data.event_id,
      original_date: parsed.data.original_date,
      is_cancelled: true,
      start_at_override: null,
      end_at_override: null,
      location_override: null,
      note: parsed.data.note || null,
      modified_by: user.id,
    },
    { onConflict: 'event_id,original_date' }
  )

  if (error) {
    console.error('[cancelEventInstance] DB error:', error.message)
    return { success: false, message: 'Failed to cancel occurrence' }
  }

  if (parsed.data.notify_subscribers === 'on') {
    await sendOccurrenceNotification(supabase, parsed.data.event_id, parsed.data.original_date, 'cancelled', {
      reason: parsed.data.note || undefined,
    })
  }

  revalidateEventPaths()
  return { success: true, message: 'Occurrence cancelled' }
}

export async function restoreEventInstance(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = restoreInstanceSchema.safeParse({
    event_id: formData.get('event_id'),
    original_date: formData.get('original_date'),
    notify_subscribers: formData.get('notify_subscribers') ?? undefined,
  })

  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Unauthorized' }

  const { error } = await supabase
    .from('event_instances')
    .delete()
    .eq('event_id', parsed.data.event_id)
    .eq('original_date', parsed.data.original_date)

  if (error) {
    console.error('[restoreEventInstance] DB error:', error.message)
    return { success: false, message: 'Failed to restore occurrence' }
  }

  if (parsed.data.notify_subscribers === 'on') {
    await sendOccurrenceNotification(supabase, parsed.data.event_id, parsed.data.original_date, 'restored', {})
  }

  revalidateEventPaths()
  return { success: true, message: 'Occurrence restored to regular schedule' }
}
