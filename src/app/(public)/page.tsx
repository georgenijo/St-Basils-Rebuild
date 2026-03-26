import type { Metadata } from 'next'
import Link from 'next/link'

import { createClient } from '@/lib/supabase/server'
import { Button, Card, GoldDivider, ScrollReveal, SectionHeader } from '@/components/ui'
import { PinnedAnnouncementsBanner } from '@/components/features/PinnedAnnouncementsBanner'

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

export default async function HomePage() {
  const supabase = await createClient()

  // Fetch recent announcements for the section (max 3)
  const { data: recentAnnouncements } = await supabase
    .from('announcements')
    .select('id, title, slug, body, priority, is_pinned, published_at')
    .order('priority', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(3)

  // Fetch pinned announcements for the banner
  const { data: pinnedAnnouncements } = await supabase
    .from('announcements')
    .select('id, title, slug, priority')
    .eq('is_pinned', true)
    .order('priority', { ascending: false })

  const recent = (recentAnnouncements as AnnouncementRow[]) || []
  const pinned =
    (pinnedAnnouncements as { id: string; title: string; slug: string; priority: number }[]) || []

  return (
    <>
      {/* ── Pinned Announcements Banner ────────────────────────── */}
      <PinnedAnnouncementsBanner announcements={pinned} />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative flex min-h-[calc(100svh-4rem)] items-center justify-center bg-charcoal">
        {/* TODO: Replace gradient with video/image background */}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-charcoal via-charcoal/90 to-charcoal/70"
          aria-hidden="true"
        />

        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center">
          <h1 className="animate-drop-in font-heading text-[2.5rem] font-light leading-[1.1] text-cream-50 md:text-[4rem]">
            St. Basil&#39;s Syriac Orthodox Church
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-cream-50/80">
            Serving the Jacobite Malayalee community in New England
          </p>
        </div>

        {/* Scroll chevron */}
        <div
          className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce motion-reduce:animate-none"
          aria-hidden="true"
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-cream-50/60"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </section>

      {/* ── Service Times Bar ────────────────────────────────── */}
      <section className="bg-burgundy-700 py-6 text-cream-50">
        <dl className="mx-auto grid max-w-[1200px] grid-cols-1 gap-6 px-4 text-center sm:grid-cols-3 sm:px-6 lg:px-8">
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
          <div>
            <dt className="font-heading text-lg font-semibold text-cream-50">Contact</dt>
            <dd className="mt-1 text-sm text-cream-50/80">
              <a
                href="tel:+16175270527"
                className="inline-flex min-h-[44px] items-center transition-colors hover:text-cream-50"
              >
                (617) 527-0527
              </a>
            </dd>
          </div>
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

      {/* ── Events CTA (static placeholder) ──────────────────── */}
      <section className="py-16 md:py-22 lg:py-28">
        <ScrollReveal className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <SectionHeader
              title="Upcoming Events"
              subtitle="From feast days to fellowship gatherings, there is always something happening at St. Basil's."
            />
            <p className="mt-8 text-base leading-relaxed text-wood-800">
              Check our events calendar for service schedules, special observances, and community
              gatherings throughout the year.
            </p>
            <div className="mt-10">
              <Button href="/events">View Events Calendar</Button>
            </div>
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
