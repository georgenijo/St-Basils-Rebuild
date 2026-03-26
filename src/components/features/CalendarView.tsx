'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import rrulePlugin from '@fullcalendar/rrule'

import { CHURCH_TIME_ZONE } from '@/lib/event-time'
import type { EventClickArg } from '@fullcalendar/core'
import type { CalendarEvent } from '@/components/features/EventCalendar'

const CATEGORY_COLORS: Record<string, { bg: string; border: string }> = {
  liturgical: { bg: '#9B1B3D', border: '#7A1530' },
  community: { bg: '#253341', border: '#1c2831' },
  special: { bg: '#4A3729', border: '#352618' },
}

interface CalendarViewProps {
  events: CalendarEvent[]
}

export function CalendarView({ events }: CalendarViewProps) {
  const router = useRouter()

  const [initialView] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'listWeek' : 'dayGridMonth'
  )

  const coloredEvents = events.map((event) => ({
    ...event,
    backgroundColor: CATEGORY_COLORS[event.extendedProps.category]?.bg,
    borderColor: CATEGORY_COLORS[event.extendedProps.category]?.border,
    textColor: '#FFFDF8',
  }))

  const handleEventClick = useCallback(
    (info: EventClickArg) => {
      const slug = info.event.extendedProps.slug
      if (slug) {
        router.push(`/events/${slug}`)
      }
    },
    [router]
  )

  return (
    <FullCalendar
      plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, rrulePlugin]}
      initialView={initialView}
      headerToolbar={{
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,listWeek',
      }}
      events={coloredEvents}
      eventClick={handleEventClick}
      height="auto"
      timeZone={CHURCH_TIME_ZONE}
      dayMaxEvents={3}
      eventDisplay="block"
      nowIndicator
      fixedWeekCount={false}
      buttonText={{
        today: 'Today',
        month: 'Month',
        week: 'Week',
        list: 'List',
      }}
    />
  )
}
