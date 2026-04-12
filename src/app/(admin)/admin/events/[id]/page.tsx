import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { formatInChurchTimeZone, getChurchTimeZoneName } from '@/lib/event-time'
import { createClient } from '@/lib/supabase/server'
import { Button, Card } from '@/components/ui'
import { RsvpAdminPanel } from '@/components/features/RsvpAdminPanel'

import type { RsvpSettings } from '@/lib/validators/rsvp'

export const metadata: Metadata = {
  title: 'Event Details',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminEventDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: event } = await supabase
    .from('events')
    .select('id, title, slug, location, start_at, end_at, category, rsvp_settings')
    .eq('id', id)
    .single()

  if (!event) notFound()

  const rsvpSettings = (event.rsvp_settings as RsvpSettings) ?? { enabled: false }

  // Fetch RSVPs if RSVP is enabled
  interface RsvpRow {
    id: string
    name: string
    headcount: number
    children_count: number | null
    dietary: string | null
    bringing: string | null
    notes: string | null
    family_id: string | null
    created_at: string
    families: { family_name: string } | null
  }

  let rsvps: RsvpRow[] = []

  if (rsvpSettings.enabled) {
    const { data } = await supabase
      .from('event_rsvps')
      .select(
        'id, name, headcount, children_count, dietary, bringing, notes, family_id, created_at, families!left(family_name)'
      )
      .eq('event_id', id)
      .order('created_at', { ascending: false })

    // Supabase returns joined table as array; flatten to single object
    rsvps = (data ?? []).map((row) => ({
      ...row,
      families: Array.isArray(row.families) ? (row.families[0] ?? null) : row.families,
    })) as RsvpRow[]
  }

  const date = formatInChurchTimeZone(event.start_at, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const time = formatInChurchTimeZone(event.start_at, {
    hour: 'numeric',
    minute: '2-digit',
  })

  const timeZone = getChurchTimeZoneName(event.start_at)

  let timeRange = `${time} ${timeZone}`
  if (event.end_at) {
    const endTime = formatInChurchTimeZone(event.end_at, {
      hour: 'numeric',
      minute: '2-digit',
    })
    timeRange = `${time} \u2013 ${endTime} ${timeZone}`
  }

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      <div className="mb-6">
        <Link
          href="/admin/events"
          className="inline-flex items-center gap-1 font-body text-sm text-wood-800/60 transition-colors hover:text-burgundy-700"
        >
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
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          Back to Events
        </Link>
      </div>

      {/* Event header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-wood-900">{event.title}</h1>
          <div className="mt-2 space-y-1">
            <p className="font-body text-sm text-wood-800/80">{date}</p>
            <p className="font-body text-sm text-wood-800/80">{timeRange}</p>
            {event.location && (
              <p className="font-body text-sm text-wood-800/80">{event.location}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button href={`/admin/events/${id}/charges`} size="sm" variant="secondary">
            Manage Charges
          </Button>
          <Button href={`/admin/events/${id}/edit`} size="sm" variant="secondary">
            Edit Event
          </Button>
        </div>
      </div>

      {/* RSVP Section */}
      {rsvpSettings.enabled ? (
        <RsvpAdminPanel
          eventId={event.id}
          eventSlug={event.slug}
          eventTitle={event.title}
          eventStartAt={event.start_at}
          eventLocation={event.location}
          rsvps={rsvps}
        />
      ) : (
        <Card variant="outlined">
          <Card.Body className="py-12 text-center">
            <p className="font-body text-sm text-wood-800/60">
              RSVP is not enabled for this event.
            </p>
            <Button href={`/admin/events/${id}/edit`} size="sm" variant="ghost" className="mt-3">
              Edit event to enable RSVP
            </Button>
          </Card.Body>
        </Card>
      )}
    </main>
  )
}
