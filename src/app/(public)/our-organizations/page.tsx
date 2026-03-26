import type { Metadata } from 'next'
import Link from 'next/link'
import { PortableText } from 'next-sanity'

import { sanityFetch } from '@/lib/sanity/client'
import { SanityImage } from '@/lib/sanity/image'
import { allOrganizationsQuery } from '@/lib/sanity/queries'
import { cn } from '@/lib/utils'
import { breadcrumbSchema } from '@/lib/structured-data'
import { GoldDivider, JsonLd, ScrollReveal } from '@/components/ui'

import type { Organization } from '@/lib/sanity/types'

const fallbackDescription =
  "Explore the organizations of St. Basil's Syriac Orthodox Church in Boston — Sunday School, youth groups, men's and women's fellowships serving our community."

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Our Organizations',
    description: fallbackDescription,
    openGraph: {
      title: "Our Organizations | St. Basil's Syriac Orthodox Church",
      description: fallbackDescription,
      images: ['/images/our-organizations-hero.jpg'],
    },
  }
}

export const revalidate = 60

export default async function OurOrganizationsPage() {
  const organizations = await sanityFetch<Organization[]>({
    query: allOrganizationsQuery,
    tags: ['organization'],
  })

  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'Our Organizations', path: '/our-organizations' }])} />

      {/* Parallax Hero */}
      <section className="relative flex h-[40vh] items-center justify-center overflow-hidden md:h-[60vh]">
        <div
          className="absolute inset-0 bg-cover bg-fixed bg-center"
          style={{ backgroundImage: "url('/images/our-organizations-hero.jpg')" }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
        <h1 className="relative z-10 animate-drop-in px-4 text-center font-heading text-[2.5rem] font-light leading-[1.1] text-cream-50 md:text-[4rem]">
          Our Organizations
        </h1>
      </section>

      {/* Organizations */}
      {organizations.length > 0 ? (
        organizations.map((org, index) => {
          const imageFirst = index % 2 === 0
          const isAlternateBg = index % 2 === 1

          return (
            <section
              key={org._id}
              className={cn(
                'py-16 md:py-22 lg:py-28',
                isAlternateBg ? 'bg-sand' : 'bg-cream-50'
              )}
            >
              <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
                <ScrollReveal direction="up">
                  <article
                    className={cn(
                      'flex flex-col gap-8 md:flex-row md:items-center md:gap-12 lg:gap-16',
                      !imageFirst && 'md:flex-row-reverse'
                    )}
                  >
                    {/* Photo */}
                    {org.photo && (
                      <div className="w-full md:w-5/12">
                        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-md">
                          <SanityImage
                            image={org.photo}
                            alt={org.name}
                            fill
                            sizes="(max-width: 768px) 100vw, 40vw"
                            lqip={org.photoLqip}
                          />
                        </div>
                      </div>
                    )}

                    {/* Content */}
                    <div className={cn('w-full', org.photo ? 'md:w-7/12' : 'md:w-full')}>
                      <h2 className="font-heading text-[1.75rem] font-semibold leading-[1.3] text-wood-900 md:text-[2.25rem]">
                        {org.name}
                      </h2>

                      <GoldDivider className="my-5 mx-0" />

                      {org.description && (
                        <div className="space-y-4 text-base leading-relaxed text-wood-800">
                          <PortableText value={org.description} />
                        </div>
                      )}

                      {org.missionStatement && (
                        <p className="mt-6 text-sm leading-relaxed text-wood-800/80 italic">
                          {org.missionStatement}
                        </p>
                      )}

                      {/* Scripture Quote */}
                      {org.scriptureQuote?.text && (
                        <blockquote className="mt-8 border-l-4 border-burgundy-700 py-2 pl-6">
                          <p className="font-heading text-lg leading-relaxed text-wood-900 italic">
                            &ldquo;{org.scriptureQuote.text}&rdquo;
                          </p>
                          {org.scriptureQuote.reference && (
                            <footer className="mt-2 text-sm font-medium text-burgundy-700">
                              &mdash; {org.scriptureQuote.reference}
                            </footer>
                          )}
                        </blockquote>
                      )}

                      {/* External Link */}
                      {org.externalLink && (
                        <div className="mt-8">
                          <Link
                            href={org.externalLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 font-medium text-burgundy-700 underline underline-offset-4 transition-colors hover:text-burgundy-800"
                          >
                            Visit {org.name}
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                          </Link>
                        </div>
                      )}
                    </div>
                  </article>
                </ScrollReveal>
              </div>
            </section>
          )
        })
      ) : (
        <section className="py-16 md:py-22 lg:py-28">
          <div className="mx-auto max-w-[1200px] px-4 text-center sm:px-6 lg:px-8">
            <p className="text-lg text-wood-800/60">
              Organization information is being updated. Please check back soon.
            </p>
          </div>
        </section>
      )}
    </>
  )
}
