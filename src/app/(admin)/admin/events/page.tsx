import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui'
import { EventsTable } from '@/components/features/EventsTable'

export const metadata: Metadata = {
  title: 'Events',
}

export default async function EventsPage() {
  const supabase = await createClient()

  const { data: events } = await supabase
    .from('events')
    .select('id, title, slug, start_at, end_at, category, is_recurring, created_at')
    .order('start_at', { ascending: false })

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-wood-900">Events</h1>
          <p className="mt-1 font-body text-sm text-wood-800/60">
            Manage parish events, liturgical services, and community gatherings.
          </p>
        </div>
        <div className="flex items-center gap-2">
        <Button href="/admin/events/calendar" variant="ghost" size="sm">
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
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Calendar
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

      <EventsTable events={events ?? []} />
    </main>
  )
}
