import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { PageHero, SectionHeader, ScrollReveal } from '@/components/ui'
import { EventCalendar } from '@/components/features/EventCalendar'

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
}

function transformEvents(events: EventRow[]): CalendarEvent[] {
  return events.map((event) => {
    const base = {
      id: event.id,
      title: event.title,
      extendedProps: {
        slug: event.slug,
        category: event.category,
        location: event.location,
      },
    }

    if (event.is_recurring && event.recurrence_rules.length > 0) {
      const rule = event.recurrence_rules[0]
      const dtstart = new Date(rule.dtstart)
        .toISOString()
        .replace(/[-:]/g, '')
        .split('.')[0]
      const rruleStr = `DTSTART:${dtstart}Z\nRRULE:${rule.rrule_string}`

      let duration: string | undefined
      if (event.end_at) {
        const diffMs = new Date(event.end_at).getTime() - new Date(event.start_at).getTime()
        const hours = Math.floor(diffMs / 3600000)
        const minutes = Math.floor((diffMs % 3600000) / 60000)
        duration = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
      }

      return { ...base, rrule: rruleStr, duration }
    }

    return {
      ...base,
      start: event.start_at,
      end: event.end_at || undefined,
    }
  })
}

export default async function EventsPage() {
  const supabase = await createClient()

  const { data: events } = await supabase
    .from('events')
    .select('*, recurrence_rules(*)')
    .order('start_at', { ascending: true })

  const calendarEvents = transformEvents((events as EventRow[]) || [])

  return (
    <>
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
            <EventCalendar events={calendarEvents} />
          </div>
        </div>
      </section>
    </>
  )
}
