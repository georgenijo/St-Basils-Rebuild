import type { Metadata } from 'next'
import Link from 'next/link'

import { createClient } from '@/lib/supabase/server'
import { PageHero, SectionHeader, Card, ScrollReveal, Button } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Announcements',
  description:
    "Stay up to date with the latest announcements from St. Basil's Syriac Orthodox Church in Boston.",
  openGraph: {
    title: "Announcements | St. Basil's Syriac Orthodox Church",
    description:
      "Stay up to date with the latest announcements from St. Basil's Syriac Orthodox Church.",
  },
}

const PAGE_SIZE = 10

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

interface PageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function AnnouncementsPage({ searchParams }: PageProps) {
  const { page: pageParam } = await searchParams
  const currentPage = Math.max(1, parseInt(pageParam || '1', 10) || 1)
  const offset = (currentPage - 1) * PAGE_SIZE

  const supabase = await createClient()

  // RLS handles filtering to published + non-expired
  const { data: announcements, count } = await supabase
    .from('announcements')
    .select('id, title, slug, body, priority, is_pinned, published_at, expires_at, created_at', {
      count: 'exact',
    })
    .order('priority', { ascending: false })
    .order('published_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const items = (announcements as AnnouncementRow[]) || []
  const totalCount = count || 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <>
      <PageHero title="Announcements" backgroundImage="/images/about/church-exterior.jpg" />

      <section className="py-16 md:py-22 lg:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <SectionHeader
              title="Parish Announcements"
              subtitle="Stay up to date with the latest from our parish."
              as="h2"
            />
          </ScrollReveal>

          {items.length === 0 ? (
            <ScrollReveal>
              <p className="mt-12 text-center text-wood-800/60">
                No announcements at this time. Check back soon.
              </p>
            </ScrollReveal>
          ) : (
            <>
              <div className="mt-12 space-y-6">
                {items.map((item) => (
                  <ScrollReveal key={item.id}>
                    <Link href={`/announcements/${item.slug}`} className="group block">
                      <Card
                        variant="outlined"
                        className="transition-shadow duration-200 group-hover:shadow-md"
                      >
                        <Card.Body>
                          <div className="flex flex-wrap items-center gap-3">
                            <time
                              dateTime={item.published_at}
                              className="text-sm font-medium text-burgundy-700"
                            >
                              {formatDate(item.published_at)}
                            </time>
                            {item.priority > 0 && PRIORITY_LABELS[item.priority] && (
                              <span
                                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_COLORS[item.priority]}`}
                              >
                                {PRIORITY_LABELS[item.priority]}
                              </span>
                            )}
                            {item.is_pinned && (
                              <span className="inline-block rounded-full border border-gold-500/40 bg-gold-500/10 px-2.5 py-0.5 text-xs font-medium text-wood-800">
                                Pinned
                              </span>
                            )}
                          </div>
                          <h3 className="mt-2 font-heading text-xl font-semibold text-wood-900 transition-colors group-hover:text-burgundy-700 md:text-2xl">
                            {item.title}
                          </h3>
                          {extractPlainText(item.body) && (
                            <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-wood-800/80">
                              {extractPlainText(item.body)}
                            </p>
                          )}
                        </Card.Body>
                      </Card>
                    </Link>
                  </ScrollReveal>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <nav
                  className="mt-12 flex items-center justify-center gap-4"
                  aria-label="Announcements pagination"
                >
                  {currentPage > 1 ? (
                    <Button
                      href={`/announcements?page=${currentPage - 1}`}
                      variant="secondary"
                      size="sm"
                    >
                      Previous
                    </Button>
                  ) : (
                    <span className="inline-flex items-center rounded-lg border border-wood-800/20 px-4 py-2 text-sm font-medium text-wood-800/40">
                      Previous
                    </span>
                  )}

                  <span className="text-sm text-wood-800/60">
                    Page {currentPage} of {totalPages}
                  </span>

                  {currentPage < totalPages ? (
                    <Button
                      href={`/announcements?page=${currentPage + 1}`}
                      variant="secondary"
                      size="sm"
                    >
                      Next
                    </Button>
                  ) : (
                    <span className="inline-flex items-center rounded-lg border border-wood-800/20 px-4 py-2 text-sm font-medium text-wood-800/40">
                      Next
                    </span>
                  )}
                </nav>
              )}
            </>
          )}
        </div>
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
