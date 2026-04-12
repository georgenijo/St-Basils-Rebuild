import { NextResponse } from 'next/server'
import { createEvents } from 'ics'

import { toUtcDateArray } from '@/lib/event-time'
import { createClient } from '@/lib/supabase/server'
import { renderTiptapHTML } from '@/lib/tiptap'

import type { EventAttributes } from 'ics'

interface EventInstanceRow {
  original_date: string
  is_cancelled: boolean
  start_at_override: string | null
  end_at_override: string | null
  location_override: string | null
  note: string | null
}

interface EventRow {
  id: string
  title: string
  slug: string
  description: unknown
  location: string | null
  start_at: string
  end_at: string | null
  is_recurring: boolean
  recurrence_rules: {
    rrule_string: string
    dtstart: string
    until: string | null
  }[]
  event_instances: EventInstanceRow[]
}

export const revalidate = 3600

export async function GET() {
  const supabase = await createClient()

  const { data: events, error } = await supabase
    .from('events')
    .select('*, recurrence_rules(*), event_instances(*)')
    .order('start_at', { ascending: true })

  if (error || !events) {
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }

  const icsEvents: EventAttributes[] = []

  for (const event of events as EventRow[]) {
    const start = toUtcDateArray(event.start_at)
    const descriptionHtml = renderTiptapHTML(event.description)
    const description = descriptionHtml ? descriptionHtml.replace(/<[^>]*>/g, '').trim() : undefined

    const recurrenceRule =
      event.is_recurring && event.recurrence_rules.length > 0
        ? event.recurrence_rules[0].rrule_string
        : undefined

    const instances = event.event_instances || []

    // Exclusion dates: all instance dates (both cancelled and modified)
    const exclusionDates =
      instances.length > 0
        ? instances.map((inst) => toUtcDateArray(inst.original_date))
        : undefined

    const base: EventAttributes = {
      uid: `${event.id}@stbasilsboston.org`,
      title: event.title,
      start,
      startInputType: 'utc',
      ...(event.end_at
        ? { end: toUtcDateArray(event.end_at), endInputType: 'utc' as const }
        : { duration: { hours: 1 } }),
      ...(description && { description }),
      ...(event.location && { location: event.location }),
      ...(recurrenceRule && { recurrenceRule }),
      ...(exclusionDates && { exclusionDates }),
      url: `https://stbasilsboston.org/events/${event.slug}`,
      organizer: {
        name: "St. Basil's Syriac Orthodox Church",
        email: 'info@stbasilsboston.org',
      },
    }

    icsEvents.push(base)

    // Add separate events for modified (non-cancelled) instances
    for (const inst of instances) {
      if (inst.is_cancelled) continue

      const instStart = toUtcDateArray(inst.start_at_override || inst.original_date)
      const instDescription = inst.note || description

      icsEvents.push({
        uid: `${event.id}-${inst.original_date}@stbasilsboston.org`,
        title: event.title,
        start: instStart,
        startInputType: 'utc',
        ...(inst.end_at_override
          ? { end: toUtcDateArray(inst.end_at_override), endInputType: 'utc' as const }
          : event.end_at
            ? { end: toUtcDateArray(event.end_at), endInputType: 'utc' as const }
            : { duration: { hours: 1 } }),
        ...(instDescription && { description: instDescription }),
        location: inst.location_override || event.location || undefined,
        url: `https://stbasilsboston.org/events/${event.slug}`,
        organizer: {
          name: "St. Basil's Syriac Orthodox Church",
          email: 'info@stbasilsboston.org',
        },
      })
    }
  }

  const { error: icsError, value } = createEvents(icsEvents, {
    productId: '-//St. Basils Syriac Orthodox Church//Events//EN',
    calName: "St. Basil's Church Events",
  })

  if (icsError || !value) {
    return NextResponse.json({ error: 'Failed to generate calendar' }, { status: 500 })
  }

  return new NextResponse(value, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="stbasils-events.ics"',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
