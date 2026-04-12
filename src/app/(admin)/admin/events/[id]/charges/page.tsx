import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { EventChargesForm } from '@/components/features/EventChargesForm'

export const metadata: Metadata = {
  title: 'Manage Event Charges',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EventChargesPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch event, families, and existing charges in parallel
  const [eventResult, familiesResult, chargesResult] = await Promise.all([
    supabase.from('events').select('id, title, start_at').eq('id', id).single(),
    supabase.from('families').select('id, family_name').order('family_name'),
    supabase
      .from('event_charges')
      .select('family_id, amount, paid, families!inner(family_name)')
      .eq('event_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!eventResult.data) notFound()

  const event = eventResult.data
  const families = familiesResult.data ?? []

  // Flatten Supabase joined table (returns array for !inner joins)
  const existingCharges = (chargesResult.data ?? []).map((row) => {
    const fam = Array.isArray(row.families) ? row.families[0] : row.families
    return {
      family_id: row.family_id,
      family_name: (fam as { family_name: string })?.family_name ?? 'Unknown',
      amount: Number(row.amount),
      paid: row.paid,
    }
  })

  return (
    <main className="px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      <div className="mb-6">
        <Link
          href={`/admin/events/${id}`}
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
          Back to Event
        </Link>
      </div>

      {/* Page header */}
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-semibold text-wood-900">Manage Charges</h1>
        <p className="mt-2 font-body text-sm text-wood-800/80">{event.title}</p>
      </div>

      {/* Charges form */}
      <div className="max-w-2xl">
        <EventChargesForm
          eventId={event.id}
          eventTitle={event.title}
          families={families}
          existingCharges={existingCharges}
        />
      </div>
    </main>
  )
}
