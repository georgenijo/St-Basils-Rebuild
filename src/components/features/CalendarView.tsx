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
import type { EventClickArg, EventMountArg, EventContentArg } from '@fullcalendar/core'
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

  const INSTANCE_COLORS: Record<string, { bg: string; border: string }> = {
    modified: { bg: '#d97706', border: '#b45309' },
    cancelled: { bg: '#dc2626', border: '#b91c1c' },
  }

  const coloredEvents = events.map((event) => {
    const instanceType = event.extendedProps.instanceType
    const colors = instanceType
      ? INSTANCE_COLORS[instanceType]
      : CATEGORY_COLORS[event.extendedProps.category]

    return {
      ...event,
      backgroundColor: colors?.bg,
      borderColor: colors?.border,
      textColor: '#FFFDF8',
    }
  })

  const handleEventClick = useCallback(
    (info: EventClickArg) => {
      const slug = info.event.extendedProps.slug
      if (slug) {
        router.push(`/events/${slug}`)
      }
    },
    [router]
  )

  const handleEventDidMount = useCallback((info: EventMountArg) => {
    const instanceType = info.event.extendedProps.instanceType
    if (instanceType === 'cancelled') {
      info.el.style.opacity = '0.65'
      info.el.style.textDecoration = 'line-through'
    }
  }, [])

  const handleEventContent = useCallback((arg: EventContentArg) => {
    const instanceType = arg.event.extendedProps.instanceType
    const note = arg.event.extendedProps.note

    if (instanceType === 'cancelled' && note) {
      const container = document.createElement('div')
      container.className = 'fc-event-main-frame'

      const titleEl = document.createElement('span')
      titleEl.style.textDecoration = 'line-through'
      titleEl.textContent = arg.event.title
      container.appendChild(titleEl)

      const noteEl = document.createElement('div')
      noteEl.style.fontSize = '10px'
      noteEl.style.opacity = '0.8'
      noteEl.textContent = note
      container.appendChild(noteEl)

      return { domNodes: [container] }
    }

    return undefined
  }, [])

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
      eventDidMount={handleEventDidMount}
      eventContent={handleEventContent}
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
