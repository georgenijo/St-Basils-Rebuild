'use client'

import { useCallback } from 'react'

import { Button } from '@/components/ui'
import { toUtcDateArray } from '@/lib/event-time'

interface AddToCalendarProps {
  title: string
  description?: string
  location?: string | null
  startAt: string
  endAt?: string | null
  rruleString?: string | null
}

export function AddToCalendar({
  title,
  description,
  location,
  startAt,
  endAt,
  rruleString,
}: AddToCalendarProps) {
  const handleDownload = useCallback(async () => {
    const { createEvent } = await import('ics')

    const start = toUtcDateArray(startAt)
    const eventAttrs: Parameters<typeof createEvent>[0] = {
      title,
      start,
      startInputType: 'utc',
      ...(endAt ? { end: toUtcDateArray(endAt), endInputType: 'utc' } : { duration: { hours: 1 } }),
      ...(description && { description }),
      ...(location && { location }),
      ...(rruleString && { recurrenceRule: rruleString }),
    }

    const { error, value } = createEvent(eventAttrs)
    if (error || !value) return

    const blob = new Blob([value], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [title, description, location, startAt, endAt, rruleString])

  return (
    <Button variant="secondary" size="sm" onClick={handleDownload}>
      <svg
        className="mr-2 h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
      </svg>
      Add to Calendar
    </Button>
  )
}
