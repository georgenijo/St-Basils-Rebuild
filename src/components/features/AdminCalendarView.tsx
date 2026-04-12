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
import {
  OccurrenceModal,
  type OccurrenceModalMode,
  type OccurrenceEventData,
  type OccurrenceInstanceData,
} from '@/components/features/OccurrenceModal'

import type { EventClickArg, EventMountArg, EventContentArg } from '@fullcalendar/core'

export interface AdminCalendarEvent {
  id: string
  title: string
  start?: string
  end?: string
  rrule?: string
  duration?: string
  extendedProps: {
    instanceType: 'recurring' | 'modified' | 'cancelled' | 'single'
    eventId: string
    slug: string
    category: string
    location: string | null
    instance?: {
      id: string
      originalDate: string
      isCancelled: boolean
      startAtOverride: string | null
      endAtOverride: string | null
      locationOverride: string | null
      note: string | null
      modifiedBy: string | null
      updatedAt: string
    } | null
    originalStart?: string
    originalLocation?: string | null
  }
}

interface AdminCalendarViewProps {
  events: AdminCalendarEvent[]
}

const CATEGORY_COLORS: Record<string, { bg: string; border: string }> = {
  liturgical: { bg: '#9B1B3D', border: '#7A1530' },
  community: { bg: '#253341', border: '#1c2831' },
  special: { bg: '#4A3729', border: '#352618' },
}

const INSTANCE_COLORS: Record<string, { bg: string; border: string }> = {
  modified: { bg: '#d97706', border: '#b45309' },
  cancelled: { bg: '#dc2626', border: '#b91c1c' },
  single: { bg: '#059669', border: '#047857' },
}

interface ModalState {
  open: boolean
  mode: OccurrenceModalMode
  eventData: OccurrenceEventData | null
  instanceData: OccurrenceInstanceData | null
}

export function AdminCalendarView({ events }: AdminCalendarViewProps) {
  const router = useRouter()

  const [initialView] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'listWeek' : 'dayGridMonth'
  )

  const [modal, setModal] = useState<ModalState>({
    open: false,
    mode: 'action',
    eventData: null,
    instanceData: null,
  })

  const coloredEvents = events.map((event) => {
    const { instanceType, category } = event.extendedProps
    const colors =
      instanceType === 'recurring'
        ? (CATEGORY_COLORS[category] ?? CATEGORY_COLORS.community)
        : (INSTANCE_COLORS[instanceType] ?? CATEGORY_COLORS[category] ?? CATEGORY_COLORS.community)

    return {
      ...event,
      backgroundColor: colors.bg,
      borderColor: colors.border,
      textColor: '#FFFDF8',
    }
  })

  const handleEventDidMount = useCallback((info: EventMountArg) => {
    const instanceType = info.event.extendedProps.instanceType
    if (instanceType === 'cancelled') {
      info.el.style.opacity = '0.65'
      info.el.style.textDecoration = 'line-through'
    }
  }, [])

  const handleEventContent = useCallback((arg: EventContentArg) => {
    const instanceType = arg.event.extendedProps.instanceType
    let icon = ''
    switch (instanceType) {
      case 'recurring':
        icon = '⟳ '
        break
      case 'modified':
        icon = '✎ '
        break
      case 'cancelled':
        icon = '✕ '
        break
    }

    const titleEl = document.createElement('span')
    if (instanceType === 'cancelled') {
      titleEl.style.textDecoration = 'line-through'
    }
    titleEl.textContent = arg.event.title

    const container = document.createElement('div')
    container.className = 'fc-event-main-frame'
    if (icon) {
      const iconEl = document.createElement('span')
      iconEl.textContent = icon
      iconEl.setAttribute('aria-hidden', 'true')
      container.appendChild(iconEl)
    }
    container.appendChild(titleEl)

    if (arg.timeText) {
      const timeEl = document.createElement('div')
      timeEl.className = 'fc-event-time'
      timeEl.textContent = arg.timeText
      const wrapper = document.createElement('div')
      wrapper.appendChild(timeEl)
      wrapper.appendChild(container)
      return { domNodes: [wrapper] }
    }

    return { domNodes: [container] }
  }, [])

  const handleEventClick = useCallback(
    (info: EventClickArg) => {
      info.jsEvent.preventDefault()
      const ext = info.event.extendedProps
      const instanceType = ext.instanceType as string

      if (instanceType === 'single') {
        router.push(`/admin/events/${ext.eventId}/edit`)
        return
      }

      const eventData: OccurrenceEventData = {
        eventId: ext.eventId,
        title: info.event.title,
        startAt: ext.originalStart || info.event.start?.toISOString() || '',
        endAt: info.event.end?.toISOString() || null,
        location: ext.location,
        category: ext.category,
        slug: ext.slug,
      }

      const instanceRaw = ext.instance
      const instanceData: OccurrenceInstanceData | null = instanceRaw
        ? {
            id: instanceRaw.id,
            originalDate: instanceRaw.originalDate,
            isCancelled: instanceRaw.isCancelled,
            startAtOverride: instanceRaw.startAtOverride,
            endAtOverride: instanceRaw.endAtOverride,
            locationOverride: instanceRaw.locationOverride,
            note: instanceRaw.note,
            modifiedBy: instanceRaw.modifiedBy,
            updatedAt: instanceRaw.updatedAt,
          }
        : null

      let mode: OccurrenceModalMode = 'action'
      if (instanceType === 'modified') mode = 'modified'
      else if (instanceType === 'cancelled') mode = 'cancelled'

      setModal({ open: true, mode, eventData, instanceData })
    },
    [router]
  )

  const handleClose = useCallback(() => {
    setModal({ open: false, mode: 'action', eventData: null, instanceData: null })
  }, [])

  const handleModeChange = useCallback((newMode: OccurrenceModalMode) => {
    setModal((prev) => ({ ...prev, mode: newMode }))
  }, [])

  return (
    <>
      <div
        className="rounded-2xl bg-cream-50 p-2 shadow sm:p-4"
        role="region"
        aria-label="Admin events calendar"
      >
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
      </div>

      {modal.open && modal.eventData && (
        <OccurrenceModal
          open={modal.open}
          onClose={handleClose}
          mode={modal.mode}
          onModeChange={handleModeChange}
          event={modal.eventData}
          instance={modal.instanceData}
        />
      )}
    </>
  )
}
