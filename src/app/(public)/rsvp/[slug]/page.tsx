import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { formatInChurchTimeZone, getChurchTimeZoneName } from '@/lib/event-time'
import { createClient } from '@/lib/supabase/server'
import { Card, GoldDivider, ScrollReveal } from '@/components/ui'
import { RsvpForm } from '@/components/features/RsvpForm'

import type { RsvpSettings } from '@/lib/validators/rsvp'

interface PageProps {
  params: Promise<{ slug: string }>
}

async function getEvent(slug: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('events')
    .select('id, title, slug, description, location, start_at, end_at, category, rsvp_settings')
    .eq('slug', slug)
    .single()

  return data
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const event = await getEvent(slug)

  if (!event) {
    return { title: 'Event Not Found' }
  }

  const date = formatInChurchTimeZone(event.start_at, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const time = formatInChurchTimeZone(event.start_at, {
    hour: 'numeric',
    minute: '2-digit',
  })

  const parts = [date, time]
  if (event.location) parts.push(event.location)
  parts.push('RSVP now')
  const description = parts.join(' \u00B7 ')

  return {
    title: `RSVP — ${event.title}`,
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

export default async function RsvpPage({ params }: PageProps) {
  const { slug } = await params
  const event = await getEvent(slug)

  if (!event) notFound()

  const rsvpSettings = (event.rsvp_settings as RsvpSettings) ?? { enabled: false }
  if (!rsvpSettings.enabled) notFound()

  // Get logged-in user's name if available
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let userName: string | undefined
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()
    userName = profile?.full_name ?? undefined
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
    <section className="bg-cream-50 py-16 md:py-22 lg:py-28">
      <div className="mx-auto max-w-lg px-4 sm:px-6">
        <ScrollReveal>
          {/* Event Hero */}
          <div className="mb-8 text-center">
            <h1 className="font-heading text-[2rem] font-semibold leading-[1.2] text-wood-900 md:text-[2.5rem]">
              {event.title}
            </h1>
            <GoldDivider className="my-6" />
          </div>

          {/* Event Details */}
          <Card variant="outlined" className="mb-8">
            <Card.Body className="space-y-3">
              <DetailRow
                icon={
                  <svg
                    className="h-5 w-5"
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
                }
                value={date}
              />
              <DetailRow
                icon={
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                }
                value={timeRange}
              />
              {event.location && (
                <DetailRow
                  icon={
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  }
                  value={event.location}
                />
              )}
            </Card.Body>
          </Card>

          {/* RSVP Form */}
          <RsvpForm slug={slug} settings={rsvpSettings} userName={userName} />
        </ScrollReveal>
      </div>
    </section>
  )
}

function DetailRow({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="shrink-0 text-burgundy-700">{icon}</div>
      <p className="font-body text-base text-wood-800">{value}</p>
    </div>
  )
}
