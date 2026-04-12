import type { Metadata } from 'next'

import { toRRuleUtcTimestamp } from '@/lib/event-time'
import { createClient } from '@/lib/supabase/server'
import { breadcrumbSchema } from '@/lib/structured-data'
import { PageHero, SectionHeader, ScrollReveal, JsonLd } from '@/components/ui'
import { EventCalendar } from '@/components/features/EventCalendar'
import { CalendarLegend } from '@/components/features/CalendarLegend'

import type { CalendarEvent } from '@/components/features/EventCalendar'

export const metadata: Metadata = {
  title: 'Events Calendar',
  description:
    "View upcoming services, community gatherings, and special events at St. Basil's Syriac Orthodox Church in Boston.",
  openGraph: {
    title: "Events Calendar | St. Basil's Syriac Orthodox Church",
    description:
      "View upcoming services, community gatherings, and special events at St. Basil's Syriac Orthodox Church.",
  },
}

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
  category: 'liturgical' | 'community' | 'special'
  recurrence_rules: {
    rrule_string: string
    dtstart: string
    until: string | null
  }[]
  event_instances: EventInstanceRow[]
}

function computeDuration(startAt: string, endAt: string | null): string | undefined {
  if (!endAt) return undefined
  const diffMs = new Date(endAt).getTime() - new Date(startAt).getTime()
  const hours = Math.floor(diffMs / 3600000)
  const minutes = Math.floor((diffMs % 3600000) / 60000)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function computeEndForDate(
  originalDate: string,
  eventStartAt: string,
  eventEndAt: string | null
): string | undefined {
  if (!eventEndAt) return undefined
  const diffMs = new Date(eventEndAt).getTime() - new Date(eventStartAt).getTime()
  return new Date(new Date(originalDate).getTime() + diffMs).toISOString()
}

function transformEvents(events: EventRow[]): CalendarEvent[] {
  const result: CalendarEvent[] = []

  for (const event of events) {
    const baseProps = {
      slug: event.slug,
      category: event.category,
      location: event.location,
    }

    // Non-recurring events
    if (!event.is_recurring || event.recurrence_rules.length === 0) {
      result.push({
        id: event.id,
        title: event.title,
        start: event.start_at,
        end: event.end_at || undefined,
        extendedProps: baseProps,
      })
      continue
    }

    // Recurring event
    const rule = event.recurrence_rules[0]
    const instances = event.event_instances || []

    // Build rrule string, adding EXDATE if there are instance overrides
    let rruleStr = `DTSTART:${toRRuleUtcTimestamp(rule.dtstart)}\nRRULE:${rule.rrule_string}`

    if (instances.length > 0) {
      const exdates = instances.map((inst) => toRRuleUtcTimestamp(inst.original_date))
      rruleStr += `\nEXDATE:${exdates.join(',')}`
    }

    const duration = computeDuration(event.start_at, event.end_at)

    // Base recurring event
    result.push({
      id: event.id,
      title: event.title,
      rrule: rruleStr,
      duration,
      extendedProps: baseProps,
    })

    // Individual instance events
    for (const inst of instances) {
      if (inst.is_cancelled) {
        result.push({
          id: `${event.id}-cancel-${inst.original_date}`,
          title: event.title,
          start: inst.original_date,
          end: computeEndForDate(inst.original_date, event.start_at, event.end_at),
          extendedProps: {
            ...baseProps,
            instanceType: 'cancelled',
            note: inst.note,
          },
        })
      } else {
        const start = inst.start_at_override || inst.original_date
        result.push({
          id: `${event.id}-mod-${inst.original_date}`,
          title: event.title,
          start,
          end:
            inst.end_at_override ||
            computeEndForDate(start, event.start_at, event.end_at),
          extendedProps: {
            ...baseProps,
            location: inst.location_override || event.location,
            instanceType: 'modified',
            note: inst.note,
          },
        })
      }
    }
  }

  return result
}

export default async function EventsPage() {
  const supabase = await createClient()

  const { data: events } = await supabase
    .from('events')
    .select('*, recurrence_rules(*), event_instances(*)')
    .order('start_at', { ascending: true })

  const calendarEvents = transformEvents((events as EventRow[]) || [])

  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'Events Calendar', path: '/events' }])} />
      <PageHero title="Events Calendar" backgroundImage="/images/about/church-exterior.jpg" />

      <section className="py-16 md:py-22 lg:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <SectionHeader
              title="Upcoming Events"
              subtitle="Stay connected with services, community gatherings, and special celebrations."
              as="h2"
            />
          </ScrollReveal>

          <div className="mt-10 md:mt-14">
            <div className="mb-4">
              <CalendarLegend variant="public" />
            </div>
            <EventCalendar events={calendarEvents} />
          </div>
        </div>
      </section>
    </>
  )
}
