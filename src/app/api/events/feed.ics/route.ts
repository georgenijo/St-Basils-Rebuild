import { NextResponse } from 'next/server'
import { createEvents } from 'ics'

import { createClient } from '@/lib/supabase/server'
import { renderTiptapHTML } from '@/lib/tiptap'

import type { EventAttributes, DateArray } from 'ics'

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
}

export const revalidate = 3600

export async function GET() {
  const supabase = await createClient()

  const { data: events, error } = await supabase
    .from('events')
    .select('*, recurrence_rules(*)')
    .order('start_at', { ascending: true })

  if (error || !events) {
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }

  const icsEvents: EventAttributes[] = (events as EventRow[]).map((event) => {
    const start = toDateArray(event.start_at)
    const descriptionHtml = renderTiptapHTML(event.description)
    const description = descriptionHtml
      ? descriptionHtml.replace(/<[^>]*>/g, '').trim()
      : undefined

    const recurrenceRule =
      event.is_recurring && event.recurrence_rules.length > 0
        ? event.recurrence_rules[0].rrule_string
        : undefined

    const base: EventAttributes = {
      uid: `${event.id}@stbasilsboston.org`,
      title: event.title,
      start,
      startInputType: 'utc',
      ...(event.end_at
        ? { end: toDateArray(event.end_at), endInputType: 'utc' as const }
        : { duration: { hours: 1 } }),
      ...(description && { description }),
      ...(event.location && { location: event.location }),
      ...(recurrenceRule && { recurrenceRule }),
      url: `https://stbasilsboston.org/events/${event.slug}`,
      organizer: {
        name: "St. Basil's Syriac Orthodox Church",
        email: 'info@stbasilsboston.org',
      },
    }

    return base
  })

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

function toDateArray(isoString: string): DateArray {
  const d = new Date(isoString)
  return [
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
  ]
}
