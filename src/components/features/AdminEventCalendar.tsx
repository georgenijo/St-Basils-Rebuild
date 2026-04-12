'use client'

import dynamic from 'next/dynamic'

import { CalendarSkeleton } from '@/components/features/CalendarSkeleton'
import type { AdminCalendarEvent } from '@/components/features/AdminCalendarView'

const AdminCalendarView = dynamic(
  () =>
    import('@/components/features/AdminCalendarView').then((mod) => mod.AdminCalendarView),
  { ssr: false, loading: () => <CalendarSkeleton className="mt-6" /> }
)

interface AdminEventCalendarProps {
  events: AdminCalendarEvent[]
}

export function AdminEventCalendar({ events }: AdminEventCalendarProps) {
  return <AdminCalendarView events={events} />
}
