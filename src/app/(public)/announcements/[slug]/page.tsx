import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { formatInChurchTimeZone } from '@/lib/event-time'
import { createClient } from '@/lib/supabase/server'
import { renderTiptapHTML } from '@/lib/tiptap'
import { articleSchema, breadcrumbSchema } from '@/lib/structured-data'
import { Button, Card, GoldDivider, JsonLd, ScrollReveal } from '@/components/ui'

interface AnnouncementRow {
  id: string
  title: string
  slug: string
  body: unknown
  priority: number
  is_pinned: boolean
  published_at: string
  expires_at: string | null
  created_at: string
}

const PRIORITY_LABELS: Record<number, string> = {
  1: 'Low',
  5: 'Medium',
  10: 'High',
}

const PRIORITY_COLORS: Record<number, string> = {
  1: 'bg-sand text-wood-800',
  5: 'bg-gold-500/15 text-wood-800',
  10: 'bg-burgundy-700 text-cream-50',
}

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()

  const { data: announcement } = await supabase
    .from('announcements')
    .select('title')
    .eq('slug', slug)
    .single()

  if (!announcement) {
    return { title: 'Announcement Not Found' }
  }

  const description = `${announcement.title} — an announcement from St. Basil's Syriac Orthodox Church.`

  return {
    title: announcement.title,
    description,
    openGraph: {
      title: `${announcement.title} | St. Basil's Syriac Orthodox Church`,
      description,
      images: [
        {
          url: `/api/og/announcements/${slug}`,
          width: 1200,
          height: 630,
          alt: announcement.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${announcement.title} | St. Basil's Syriac Orthodox Church`,
      description,
      images: [`/api/og/announcements/${slug}`],
    },
  }
}

export default async function AnnouncementDetailPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createClient()

  // RLS ensures only published + non-expired are returned for public users
  const { data: announcement } = await supabase
    .from('announcements')
    .select('*')
    .eq('slug', slug)
    .single<AnnouncementRow>()

  if (!announcement) notFound()

  const bodyHtml = renderTiptapHTML(announcement.body)
  const bodyText = bodyHtml ? bodyHtml.replace(/<[^>]*>/g, '').trim() : null

  const announcementJsonLd = articleSchema({
    title: announcement.title,
    slug: announcement.slug,
    publishedAt: announcement.published_at,
    bodyText,
  })

  const breadcrumbJsonLd = breadcrumbSchema([
    { name: 'Announcements', path: '/announcements' },
    { name: announcement.title, path: `/announcements/${announcement.slug}` },
  ])

  return (
    <>
      <JsonLd data={announcementJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      <section className="bg-cream-50 py-16 md:py-22 lg:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            {/* Back link */}
            <Link
              href="/announcements"
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
              Back to Announcements
            </Link>

            {/* Header */}
            <div className="mb-8">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <time
                  dateTime={announcement.published_at}
                  className="text-sm font-medium text-burgundy-700"
                >
                  {formatDate(announcement.published_at)}
                </time>
                {announcement.priority > 0 && PRIORITY_LABELS[announcement.priority] && (
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${PRIORITY_COLORS[announcement.priority]}`}
                  >
                    {PRIORITY_LABELS[announcement.priority]}
                  </span>
                )}
                {announcement.is_pinned && (
                  <span className="inline-block rounded-full border border-gold-500/40 bg-gold-500/10 px-3 py-1 text-xs font-medium text-wood-800">
                    Pinned
                  </span>
                )}
              </div>

              <h1 className="font-heading text-[2rem] font-semibold leading-[1.2] text-wood-900 md:text-[3rem]">
                {announcement.title}
              </h1>

              <GoldDivider className="my-6 mx-0" />
            </div>

            {/* Announcement details card */}
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
                  label="Published"
                  value={formatDate(announcement.published_at)}
                />
                {announcement.expires_at && (
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
                    label="Expires"
                    value={formatDate(announcement.expires_at)}
                  />
                )}
              </Card.Body>
            </Card>

            {/* Body */}
            {bodyHtml && (
              <div className="mb-10">
                <div
                  className="prose prose-wood max-w-none font-body text-wood-800 prose-headings:font-heading prose-headings:text-wood-900 prose-a:text-burgundy-700 prose-a:underline-offset-4 hover:prose-a:text-burgundy-800"
                  dangerouslySetInnerHTML={{ __html: bodyHtml }}
                />
              </div>
            )}

            {/* Back to announcements */}
            <div className="border-t border-wood-800/10 pt-8">
              <Button href="/announcements" variant="ghost" size="sm">
                View All Announcements
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

function formatDate(dateString: string): string {
  return formatInChurchTimeZone(dateString, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}
