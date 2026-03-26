import type { Metadata } from 'next'

import { sanityFetch } from '@/lib/sanity/client'
import { urlFor, SanityImage } from '@/lib/sanity/image'
import { allUsefulLinksQuery, usefulLinksPageQuery } from '@/lib/sanity/queries'
import { breadcrumbSchema } from '@/lib/structured-data'
import { SectionHeader, ScrollReveal, JsonLd } from '@/components/ui'

import type { UsefulLink, UsefulLinksPage } from '@/lib/sanity/types'

const fallbackDescription =
  "Download liturgical texts, prayer books, and other resources from St. Basil's Syriac Orthodox Church in Boston."

export async function generateMetadata(): Promise<Metadata> {
  const pageContent = await sanityFetch<UsefulLinksPage | null>({
    query: usefulLinksPageQuery,
    tags: ['usefulLinksPage'],
  })

  const title = pageContent?.pageTitle || 'Useful Links'
  const description = fallbackDescription

  return {
    title,
    description,
    openGraph: {
      title: `${title} | St. Basil's Syriac Orthodox Church`,
      description,
      ...(pageContent?.heroImage
        ? { images: [urlFor(pageContent.heroImage).width(1200).height(630).url()] }
        : {}),
    },
  }
}

export const revalidate = 60

export default async function UsefulLinksPageRoute() {
  const [pageContent, links] = await Promise.all([
    sanityFetch<UsefulLinksPage>({
      query: usefulLinksPageQuery,
      tags: ['usefulLinksPage'],
    }),
    sanityFetch<UsefulLink[]>({
      query: allUsefulLinksQuery,
      tags: ['usefulLink'],
    }),
  ])

  const title = pageContent?.pageTitle || 'Useful Links'

  // Group links by category
  const grouped = links.reduce<Record<string, UsefulLink[]>>((acc, link) => {
    const cat = link.category || 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(link)
    return acc
  }, {})

  const categories = Object.keys(grouped)

  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'Useful Links', path: '/useful-links' }])} />

      {/* Parallax Hero */}
      <section className="relative flex h-[40vh] items-center justify-center overflow-hidden md:h-[60vh]">
        {pageContent?.heroImage ? (
          <SanityImage
            image={pageContent.heroImage}
            alt=""
            fill
            priority
            className="object-cover"
            style={{ position: 'absolute' }}
            sizes="100vw"
          />
        ) : (
          <div
            className="absolute inset-0 bg-cover bg-fixed bg-center"
            style={{ backgroundImage: "url('/images/useful-links-hero.jpg')" }}
            aria-hidden="true"
          />
        )}
        <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
        <h1 className="relative z-10 animate-drop-in px-4 text-center font-heading text-[2.5rem] font-light leading-[1.1] text-cream-50 md:text-[4rem]">
          {title}
        </h1>
      </section>

      {/* Intro */}
      {pageContent?.introText && (
        <section className="bg-cream-50 py-16 md:py-22">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <ScrollReveal direction="up">
              <p className="text-base leading-relaxed text-wood-800 md:text-lg">
                {pageContent.introText}
              </p>
            </ScrollReveal>
          </div>
        </section>
      )}

      {/* Links */}
      {links.length > 0 ? (
        <section className="bg-cream-50 py-16 md:py-22 lg:py-28">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
            {categories.length > 1 ? (
              // Multiple categories — render with section headers
              categories.map((category, catIndex) => (
                <div key={category} className={catIndex > 0 ? 'mt-16' : ''}>
                  <ScrollReveal direction="up">
                    <SectionHeader
                      title={pageContent?.sectionTitle && categories.length === 1
                        ? pageContent.sectionTitle
                        : category}
                      as="h2"
                      align="left"
                      className="mb-8"
                    />
                  </ScrollReveal>
                  <div className="space-y-4">
                    {grouped[category].map((link, index) => (
                      <LinkCard key={link._id} link={link} index={index} />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              // Single or no category — optional section title
              <>
                {pageContent?.sectionTitle && (
                  <ScrollReveal direction="up">
                    <SectionHeader
                      title={pageContent.sectionTitle}
                      as="h2"
                      className="mb-10"
                    />
                  </ScrollReveal>
                )}
                <div className="space-y-4">
                  {links.map((link, index) => (
                    <LinkCard key={link._id} link={link} index={index} />
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      ) : (
        <section className="py-16 md:py-22 lg:py-28">
          <div className="mx-auto max-w-[1200px] px-4 text-center sm:px-6 lg:px-8">
            <p className="text-lg text-wood-800/60">
              Resources are being updated. Please check back soon.
            </p>
          </div>
        </section>
      )}
    </>
  )
}

function LinkCard({ link, index }: { link: UsefulLink; index: number }) {
  if (!link.fileUrl) return null

  return (
    <ScrollReveal direction="up" delay={index * 0.08}>
      <a
        href={link.fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        download
        className="group flex items-center gap-4 rounded-2xl border-l-4 border-burgundy-700 bg-sand p-5 shadow-sm transition-all duration-200 hover:translate-x-[5px] hover:shadow-md sm:p-6"
      >
        {/* PDF Icon */}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-burgundy-700/10">
          <svg
            className="h-5 w-5 text-burgundy-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>

        {/* Title */}
        <span className="font-body text-base font-medium text-wood-900 transition-colors group-hover:text-burgundy-700 sm:text-lg">
          {link.title}
        </span>

        {/* Arrow */}
        <svg
          className="ml-auto h-5 w-5 shrink-0 text-wood-800/40 transition-colors group-hover:text-burgundy-700"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </a>
    </ScrollReveal>
  )
}
