import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { formatInChurchTimeZone, getChurchTimeZoneName } from '@/lib/event-time'
import { createClient } from '@/lib/supabase/server'
import { renderTiptapHTML } from '@/lib/tiptap'
import { describeRecurrence } from '@/lib/recurrence'
import { eventSchema, breadcrumbSchema } from '@/lib/structured-data'
import { Button, Card, GoldDivider, JsonLd, ScrollReveal } from '@/components/ui'
import { AddToCalendar } from '@/components/features/AddToCalendar'

interface EventRow {
  id: string
  title: string
  slug: string
  description: unknown
  location: string | null
  start_at: string
  end_at: string | null
  is_recurring: boolean
  category: 'liturgical' | 'community' | 'special'
  created_at: string
  recurrence_rules: {
    rrule_string: string
    dtstart: string
    until: string | null
  }[]
}

const CATEGORY_LABELS: Record<string, string> = {
  liturgical: 'Liturgical',
  community: 'Community',
  special: 'Special',
}

const CATEGORY_COLORS: Record<string, string> = {
  liturgical: 'bg-burgundy-700 text-cream-50',
  community: 'bg-charcoal text-cream-50',
  special: 'bg-wood-800 text-cream-50',
}

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data: event } = await supabase
    .from('events')
    .select('title, description, location, start_at')
    .eq('slug', slug)
    .single()

  if (!event) {
    return { title: 'Event Not Found' }
  }

  const description = event.location
    ? `${event.title} at ${event.location}`
    : event.title

  return {
    title: event.title,
    description,
    openGraph: {
      title: `${event.title} | St. Basil's Syriac Orthodox Church`,
      description,
      images: [
        {
          url: `/api/og/events/${slug}`,
          width: 1200,
          height: 630,
          alt: event.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${event.title} | St. Basil's Syriac Orthodox Church`,
      description,
      images: [`/api/og/events/${slug}`],
    },
  }
}

export default async function EventDetailPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: event } = await supabase
    .from('events')
    .select('*, recurrence_rules(*)')
    .eq('slug', slug)
    .single<EventRow>()

  if (!event) notFound()

  const descriptionHtml = renderTiptapHTML(event.description)
  const recurrenceRule = event.is_recurring && event.recurrence_rules.length > 0
    ? event.recurrence_rules[0]
    : null
  const recurrenceText = recurrenceRule
    ? describeRecurrence(recurrenceRule.rrule_string)
    : null

  const plainText = descriptionHtml ? stripHtml(descriptionHtml) : null

  const eventJsonLd = eventSchema({
    title: event.title,
    startAt: event.start_at,
    endAt: event.end_at,
    location: event.location,
    description: plainText,
    slug: event.slug,
  })

  const breadcrumbJsonLd = breadcrumbSchema([
    { name: 'Events', path: '/events' },
    { name: event.title, path: `/events/${event.slug}` },
  ])

  return (
    <>
      <JsonLd data={eventJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />

      <section className="bg-cream-50 py-16 md:py-22 lg:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            {/* Back link */}
            <Link
              href="/events"
              className="group mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-burgundy-700 transition-colors hover:text-burgundy-800"
            >
              <svg
                className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Back to Calendar
            </Link>

            {/* Header */}
            <div className="mb-8">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span
                  className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${CATEGORY_COLORS[event.category]}`}
                >
                  {CATEGORY_LABELS[event.category]}
                </span>
                {event.is_recurring && (
                  <span className="inline-block rounded-full border border-gold-500/40 bg-gold-500/10 px-3 py-1 text-xs font-medium text-wood-800">
                    Recurring
                  </span>
                )}
              </div>

              <h1 className="font-heading text-[2rem] font-semibold leading-[1.2] text-wood-900 md:text-[3rem]">
                {event.title}
              </h1>

              <GoldDivider className="my-6 mx-0" />
            </div>

            {/* Event details card */}
            <Card variant="outlined" className="mb-8">
              <Card.Body className="space-y-4">
                {/* Date & Time */}
                <DetailRow
                  icon={
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  }
                  label="Date"
                  value={formatDate(event.start_at)}
                />

                <DetailRow
                  icon={
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  }
                  label="Time"
                  value={formatTimeRange(event.start_at, event.end_at)}
                />

                {/* Location */}
                {event.location && (
                  <DetailRow
                    icon={
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    }
                    label="Location"
                    value={event.location}
                  />
                )}

                {/* Recurrence */}
                {recurrenceText && (
                  <DetailRow
                    icon={
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="23 4 23 10 17 10" />
                        <polyline points="1 20 1 14 7 14" />
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                      </svg>
                    }
                    label="Repeats"
                    value={recurrenceText}
                  />
                )}
              </Card.Body>
            </Card>

            {/* Add to calendar */}
            <div className="mb-10">
              <AddToCalendar
                title={event.title}
                description={plainText ?? undefined}
                location={event.location}
                startAt={event.start_at}
                endAt={event.end_at}
                rruleString={recurrenceRule?.rrule_string}
              />
            </div>

            {/* Description */}
            {descriptionHtml && (
              <div className="mb-10">
                <h2 className="font-heading text-[1.75rem] font-semibold leading-[1.3] text-wood-900 md:text-[2.25rem]">
                  Details
                </h2>
                <GoldDivider className="my-4 mx-0" />
                <div
                  className="prose prose-wood max-w-none font-body text-wood-800 prose-headings:font-heading prose-headings:text-wood-900 prose-a:text-burgundy-700 prose-a:underline-offset-4 hover:prose-a:text-burgundy-800"
                  dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                />
              </div>
            )}

            {/* Back to calendar link */}
            <div className="border-t border-wood-800/10 pt-8">
              <Button href="/events" variant="ghost" size="sm">
                View All Events
              </Button>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  )
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0 text-burgundy-700">{icon}</div>
      <div>
        <p className="text-sm font-medium text-wood-800/60">{label}</p>
        <p className="text-wood-800">{value}</p>
      </div>
    </div>
  )
}

function formatDate(isoString: string): string {
  return formatInChurchTimeZone(isoString, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTimeRange(startIso: string, endIso: string | null): string {
  const startTime = formatInChurchTimeZone(startIso, {
    hour: 'numeric',
    minute: '2-digit',
  })
  const timeZoneName = getChurchTimeZoneName(startIso)

  if (!endIso) return `${startTime} ${timeZoneName}`

  const endTime = formatInChurchTimeZone(endIso, {
    hour: 'numeric',
    minute: '2-digit',
  })

  return `${startTime} \u2013 ${endTime} ${timeZoneName}`
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}
