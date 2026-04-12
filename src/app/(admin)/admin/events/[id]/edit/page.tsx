import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { EventForm } from '@/components/features/EventForm'

export const metadata: Metadata = {
  title: 'Edit Event',
}

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: event } = await supabase
    .from('events')
    .select(
      `
      id,
      title,
      slug,
      description,
      location,
      start_at,
      end_at,
      is_recurring,
      category,
      rsvp_settings,
      recurrence_rules (rrule_string)
    `
    )
    .eq('id', id)
    .single()

  if (!event) notFound()

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
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
        <h1 className="mt-2 font-heading text-3xl font-semibold text-wood-900">Edit Event</h1>
      </div>

      <div className="max-w-2xl">
        <EventForm event={event} />
      </div>
    </main>
  )
}
