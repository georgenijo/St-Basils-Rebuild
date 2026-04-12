import type { Metadata } from 'next'

import { toRRuleUtcTimestamp } from '@/lib/event-time'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui'
import { CalendarLegend } from '@/components/features/CalendarLegend'
import { AdminEventCalendar } from '@/components/features/AdminEventCalendar'

import type { AdminCalendarEvent } from '@/components/features/AdminCalendarView'

export const metadata: Metadata = {
  title: 'Events Calendar',
}

interface EventInstanceRow {
  id: string
  original_date: string
  is_cancelled: boolean
  start_at_override: string | null
  end_at_override: string | null
  location_override: string | null
  note: string | null
  modified_by: string | null
  updated_at: string
}

interface AdminEventRow {
  id: string
  title: string
  slug: string
  description: unknown
  location: string | null
  start_at: string
  end_at: string | null
  is_recurring: boolean
  category: 'liturgical' | 'community' | 'special'
  recurrence_rules: { rrule_string: string; dtstart: string; until: string | null }[]
  event_instances: EventInstanceRow[]
}

function computeEndForInstance(
  originalDate: string,
  eventStartAt: string,
  eventEndAt: string | null
): string | undefined {
  if (!eventEndAt) return undefined
  const diffMs = new Date(eventEndAt).getTime() - new Date(eventStartAt).getTime()
  return new Date(new Date(originalDate).getTime() + diffMs).toISOString()
}

function transformAdminEvents(events: AdminEventRow[]): AdminCalendarEvent[] {
  const result: AdminCalendarEvent[] = []

  for (const event of events) {
    const baseProps = {
      eventId: event.id,
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
        extendedProps: { ...baseProps, instanceType: 'single' },
      })
      continue
    }

    // Recurring event
    const rule = event.recurrence_rules[0]
    const instances = event.event_instances || []

    // Build rrule string with EXDATE for all instance dates
    let rruleStr = `DTSTART:${toRRuleUtcTimestamp(rule.dtstart)}\nRRULE:${rule.rrule_string}`

    if (instances.length > 0) {
      const exdates = instances.map((inst) => toRRuleUtcTimestamp(inst.original_date))
      rruleStr += `\nEXDATE:${exdates.join(',')}`
    }

    // Duration for recurring events
    let duration: string | undefined
    if (event.end_at) {
      const diffMs = new Date(event.end_at).getTime() - new Date(event.start_at).getTime()
      const hours = Math.floor(diffMs / 3600000)
      const minutes = Math.floor((diffMs % 3600000) / 60000)
      duration = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    }

    // Base recurring event (with exdates)
    result.push({
      id: event.id,
      title: event.title,
      rrule: rruleStr,
      duration,
      extendedProps: { ...baseProps, instanceType: 'recurring' },
    })

    // Individual instance events
    for (const inst of instances) {
      const instanceData = {
        id: inst.id,
        originalDate: inst.original_date,
        isCancelled: inst.is_cancelled,
        startAtOverride: inst.start_at_override,
        endAtOverride: inst.end_at_override,
        locationOverride: inst.location_override,
        note: inst.note,
        modifiedBy: inst.modified_by,
        updatedAt: inst.updated_at,
      }

      if (inst.is_cancelled) {
        result.push({
          id: `${event.id}-cancelled-${inst.id}`,
          title: event.title,
          start: inst.original_date,
          end: computeEndForInstance(inst.original_date, event.start_at, event.end_at),
          extendedProps: {
            ...baseProps,
            instanceType: 'cancelled',
            instance: instanceData,
            originalStart: inst.original_date,
            originalLocation: event.location,
          },
        })
      } else {
        result.push({
          id: `${event.id}-modified-${inst.id}`,
          title: event.title,
          start: inst.start_at_override || inst.original_date,
          end:
            inst.end_at_override ||
            computeEndForInstance(
              inst.start_at_override || inst.original_date,
              event.start_at,
              event.end_at
            ),
          extendedProps: {
            ...baseProps,
            instanceType: 'modified',
            instance: instanceData,
            originalStart: inst.original_date,
            originalLocation: event.location,
            location: inst.location_override || event.location,
          },
        })
      }
    }
  }

  return result
}

export default async function AdminCalendarPage() {
  const supabase = await createClient()

  const { data: events } = await supabase
    .from('events')
    .select('*, recurrence_rules(*), event_instances(*)')
    .order('start_at', { ascending: true })

  const calendarEvents = transformAdminEvents((events as AdminEventRow[]) || [])

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-wood-900">Events Calendar</h1>
          <p className="mt-1 font-body text-sm text-wood-800/60">
            Click any recurring event to edit or cancel individual occurrences.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button href="/admin/events" variant="ghost" size="sm">
            <span className="flex items-center gap-2">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              Table View
            </span>
          </Button>
          <Button href="/admin/events/new" size="sm">
            <span className="flex items-center gap-2">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Event
            </span>
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <CalendarLegend variant="admin" />
      </div>

      <AdminEventCalendar events={calendarEvents} />
    </main>
  )
}
