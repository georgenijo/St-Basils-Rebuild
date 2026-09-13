import type { Metadata } from 'next'
import { unstable_cache } from 'next/cache'
import Link from 'next/link'

import { PUBLIC_ANNOUNCEMENTS_CACHE_TAG, PUBLIC_EVENTS_CACHE_TAG } from '@/lib/cache-tags'
import { formatInChurchTimeZone } from '@/lib/event-time'
import { formatChurchPhone, getChurchPhoneTelHref } from '@/lib/site-config'
import { getPublicSupabaseClient } from '@/lib/supabase/public'
import { getUpcomingEventOccurrences, type UpcomingEventSource } from '@/lib/upcoming-events'
import { Button, Card, GoldDivider, ScrollReveal, SectionHeader } from '@/components/ui'
import { FeastFlyer } from '@/components/features/FeastFlyer'
import { PinnedAnnouncementsBanner } from '@/components/features/PinnedAnnouncementsBanner'
import { HomeHero } from '@/components/features/HomeHero'

export const metadata: Metadata = {
  title: {
    absolute: "St. Basil's Syriac Orthodox Church — Boston, MA",
  },
  description:
    "Welcome to St. Basil's Syriac Orthodox Church in Boston, Massachusetts. Join us for Sunday services, community events, and fellowship. Serving the Jacobite Malayalee community in New England.",
  openGraph: {
    title: "St. Basil's Syriac Orthodox Church — Boston, MA",
    description:
      "Welcome to St. Basil's Syriac Orthodox Church in Boston, Massachusetts. Join us for Sunday services, community events, and fellowship.",
  },
}

interface AnnouncementRow {
  id: string
  title: string
  slug: string
  body: unknown
  priority: number
  is_pinned: boolean
  published_at: string
}

const formattedChurchPhone = formatChurchPhone()
const churchPhoneTelHref = getChurchPhoneTelHref()

/** Upper bounds on the events fetch: the page shows 3 occurrences, so 25
 *  candidate series within the next year is ample headroom for recurring
 *  expansion, cancellations, and overrides. */
const EVENTS_FETCH_LIMIT = 25
const EVENTS_HORIZON_DAYS = 366

const getHomePageData = unstable_cache(
  async () => {
    const supabase = getPublicSupabaseClient()
    const now = new Date()

    if (!supabase) {
      return {
        recentAnnouncements: null,
        pinnedAnnouncements: null,
        eventSources: null,
        generatedAt: now.toISOString(),
      }
    }

    const [{ data: recentAnnouncements }, { data: pinnedAnnouncements }, { data: eventSources }] =
      await Promise.all([
        supabase
          .from('announcements')
          .select('id, title, slug, body, priority, is_pinned, published_at')
          .order('priority', { ascending: false })
          .order('published_at', { ascending: false })
          .limit(3),
        supabase
          .from('announcements')
          .select('id, title, slug, priority')
          .eq('is_pinned', true)
          .order('priority', { ascending: false }),
        supabase
          .from('events')
          .select(
            `
            id, title, slug, location, start_at, end_at, is_recurring, category,
            recurrence_rules(rrule_string, dtstart),
            event_instances(
              original_date, is_cancelled, title_override, location_override,
              start_at_override, end_at_override
            )
          `
          )
          .or(`is_recurring.eq.true,start_at.gte.${now.toISOString()}`)
          .lte(
            'start_at',
            new Date(now.getTime() + EVENTS_HORIZON_DAYS * 24 * 60 * 60 * 1000).toISOString()
          )
          .order('start_at', { ascending: true })
          .limit(EVENTS_FETCH_LIMIT),
      ])

    return {
      recentAnnouncements,
      pinnedAnnouncements,
      eventSources,
      generatedAt: now.toISOString(),
    }
  },
  ['public-home-page-data'],
  {
    revalidate: 60,
    tags: [PUBLIC_ANNOUNCEMENTS_CACHE_TAG, PUBLIC_EVENTS_CACHE_TAG],
  }
)

export const revalidate = 60

export default async function HomePage() {
  const { recentAnnouncements, pinnedAnnouncements, eventSources, generatedAt } =
    await getHomePageData()
  const generatedAtDate = new Date(generatedAt)

  const recent = (recentAnnouncements as AnnouncementRow[]) || []
  const pinned =
    (pinnedAnnouncements as { id: string; title: string; slug: string; priority: number }[]) || []
  const upcoming = getUpcomingEventOccurrences(
    (eventSources as unknown as UpcomingEventSource[]) || [],
    generatedAtDate,
    3
  )

  return (
    <>
      {/* ── Pinned Announcements Banner ────────────────────────── */}
      <PinnedAnnouncementsBanner announcements={pinned} />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <HomeHero />

      {/* ── Feast Flyer ──────────────────────────────────────── */}
      <FeastFlyer />

      {/* ── Service Times Bar ────────────────────────────────── */}
      <section className="bg-burgundy-700 py-6 text-cream-50">
        <dl
          className={`mx-auto grid max-w-[1200px] grid-cols-1 gap-6 px-4 text-center sm:grid-cols-2 sm:px-6 lg:px-8 ${formattedChurchPhone ? 'lg:grid-cols-3' : ''}`}
        >
          <div>
            <dt className="font-heading text-lg font-semibold text-cream-50">Location</dt>
            <dd className="mt-1 text-sm text-cream-50/80">73 Ellis Street, Newton, MA 02464</dd>
          </div>
          <div>
            <dt className="font-heading text-lg font-semibold text-cream-50">Sunday Services</dt>
            <dd className="mt-1 text-sm text-cream-50/80">
              Morning Prayer 8:30 AM &middot; Holy Qurbono 9:15 AM
            </dd>
          </div>
          {formattedChurchPhone && churchPhoneTelHref && (
            <div>
              <dt className="font-heading text-lg font-semibold text-cream-50">Contact</dt>
              <dd className="mt-1 text-sm text-cream-50/80">
                <a
                  href={churchPhoneTelHref}
                  className="inline-flex min-h-[44px] items-center transition-colors hover:text-cream-50"
                >
                  {formattedChurchPhone}
                </a>
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* ── Welcome ──────────────────────────────────────────── */}
      <section className="py-16 md:py-22 lg:py-28">
        <ScrollReveal className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <SectionHeader
              title="Welcome to St. Basil's"
              subtitle="A home for faith, fellowship, and tradition in the heart of New England."
            />
            <p className="mt-8 text-base leading-relaxed text-wood-800">
              St. Basil&#39;s Syriac Orthodox Church has been a spiritual home for the Jacobite
              Malayalee community in the greater Boston area. Rooted in the ancient traditions of
              the Syriac Orthodox faith, our parish gathers each Sunday for the Holy Qurbono,
              fellowship, and the shared life of Christ.
            </p>
            <p className="mt-4 text-base leading-relaxed text-wood-800">
              Whether you are a lifelong member or visiting for the first time, you are welcome
              here.
            </p>
            <div className="mt-10">
              <Button href="/about">Learn Our History</Button>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* ── Announcements ──────────────────────────────────────── */}
      <section className="bg-sand py-16 md:py-22 lg:py-28">
        <ScrollReveal className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <SectionHeader
            title="Announcements"
            subtitle="Stay up to date with the latest from our parish."
          />
          {recent.length > 0 ? (
            <>
              <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {recent.map((item) => (
                  <Link
                    key={item.id}
                    href={`/announcements/${item.slug}`}
                    className="group block h-full"
                  >
                    <Card
                      variant="outlined"
                      className="h-full transition-shadow duration-200 group-hover:shadow-md"
                    >
                      <Card.Body>
                        <time
                          dateTime={item.published_at}
                          className="text-sm font-medium text-burgundy-700"
                        >
                          {formatDate(item.published_at)}
                        </time>
                        <h3 className="mt-2 font-heading text-xl font-semibold text-wood-900 transition-colors group-hover:text-burgundy-700">
                          {item.title}
                        </h3>
                        {extractPlainText(item.body) && (
                          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-wood-800/80">
                            {extractPlainText(item.body)}
                          </p>
                        )}
                      </Card.Body>
                    </Card>
                  </Link>
                ))}
              </div>
              <div className="mt-10 text-center">
                <Button href="/announcements" variant="secondary">
                  View All Announcements
                </Button>
              </div>
            </>
          ) : (
            <p className="mt-12 text-center text-wood-800/60">
              No announcements at this time. Check back soon.
            </p>
          )}
        </ScrollReveal>
      </section>

      {/* ── Upcoming Events ──────────────────────────────────── */}
      <section className="py-16 md:py-22 lg:py-28">
        <ScrollReveal className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <SectionHeader
            title="Upcoming Events"
            subtitle="From feast days to fellowship gatherings, there is always something happening at St. Basil's."
          />
          {upcoming.length > 0 ? (
            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
              {upcoming.map((event) => (
                <Link key={event.id} href={`/events/${event.slug}`} className="group block h-full">
                  <Card
                    variant="outlined"
                    className="h-full transition-shadow duration-200 group-hover:shadow-md"
                  >
                    <Card.Body>
                      <time
                        dateTime={event.startAt}
                        className="text-sm font-medium text-burgundy-700"
                      >
                        {formatUpcomingEventDate(event.startAt)}
                      </time>
                      <h3 className="mt-2 font-heading text-xl font-semibold text-wood-900 transition-colors group-hover:text-burgundy-700">
                        {event.title}
                      </h3>
                      <p className="mt-3 text-sm capitalize text-wood-800/70">
                        {event.category}
                        {event.location ? ` · ${event.location}` : ''}
                      </p>
                    </Card.Body>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-12 text-center text-wood-800/60">
              No upcoming events are scheduled. Check back soon.
            </p>
          )}
          <div className="mt-10 text-center">
            <Button href="/events">View Events Calendar</Button>
          </div>
        </ScrollReveal>
      </section>

      {/* ── Office Bearers CTA ───────────────────────────────── */}
      <section className="bg-charcoal py-16 md:py-22 lg:py-28">
        <ScrollReveal className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-heading text-[1.75rem] font-semibold leading-[1.3] text-cream-50 md:text-[2.25rem]">
              Our Church Leadership
            </h2>
            <GoldDivider className="my-4" />
            <p className="mt-6 text-base leading-relaxed text-cream-50/80">
              Meet the dedicated office bearers who serve our parish and guide our community.
            </p>
            <div className="mt-10">
              <Button
                href="/office-bearers"
                variant="secondary"
                className="border-cream-50 text-cream-50 hover:bg-cream-50 hover:text-charcoal"
              >
                Meet Our Office Bearers
              </Button>
            </div>
          </div>
        </ScrollReveal>
      </section>
    </>
  )
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatUpcomingEventDate(dateString: string): string {
  return formatInChurchTimeZone(dateString, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function extractPlainText(body: unknown): string {
  if (!body) return ''

  let parsed: unknown = body
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      return body as string
    }
  }

  if (typeof parsed === 'object' && parsed !== null && 'content' in parsed) {
    const doc = parsed as { content: Array<{ content?: Array<{ text?: string }> }> }
    const texts: string[] = []
    for (const node of doc.content || []) {
      for (const child of node.content || []) {
        if (child.text) texts.push(child.text)
      }
    }
    return texts.join(' ')
  }

  return ''
}
