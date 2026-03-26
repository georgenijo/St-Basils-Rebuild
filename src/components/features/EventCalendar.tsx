'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'

import { cn } from '@/lib/utils'
import { CalendarSkeleton } from '@/components/features/CalendarSkeleton'

const CalendarView = dynamic(
  () => import('@/components/features/CalendarView').then((mod) => mod.CalendarView),
  { ssr: false, loading: () => <CalendarSkeleton className="mt-6" /> }
)

export interface CalendarEvent {
  id: string
  title: string
  start?: string
  end?: string
  rrule?: string
  duration?: string
  extendedProps: {
    slug: string
    category: 'liturgical' | 'community' | 'special'
    location: string | null
  }
}

interface EventCalendarProps {
  events: CalendarEvent[]
}

const CATEGORY_COLORS: Record<string, string> = {
  liturgical: '#9B1B3D',
  community: '#253341',
  special: '#4A3729',
}

const CATEGORIES = [
  { value: 'all', label: 'All Events' },
  { value: 'liturgical', label: 'Liturgical' },
  { value: 'community', label: 'Community' },
  { value: 'special', label: 'Special' },
] as const

type CategoryFilter = (typeof CATEGORIES)[number]['value']

export function EventCalendar({ events }: EventCalendarProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all')

  const filteredEvents = useMemo(
    () =>
      activeCategory === 'all'
        ? events
        : events.filter((e) => e.extendedProps.category === activeCategory),
    [events, activeCategory]
  )

  return (
    <div>
      {/* Category Filter */}
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter events by category">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setActiveCategory(cat.value)}
            aria-pressed={activeCategory === cat.value}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              activeCategory === cat.value
                ? 'bg-burgundy-700 text-cream-50'
                : 'bg-sand text-wood-800 hover:bg-burgundy-100'
            )}
          >
            {cat.label}
            {cat.value !== 'all' && (
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[cat.value] }}
                aria-hidden="true"
              />
            )}
          </button>
        ))}
      </div>

      {/* Calendar */}
      <div
        className="rounded-2xl bg-cream-50 p-2 shadow sm:p-4"
        role="region"
        aria-label="Events calendar"
      >
        <CalendarView events={filteredEvents} />
      </div>
    </div>
  )
}
