import type { Metadata } from 'next'
import { PortableText } from 'next-sanity'

import { sanityFetch } from '@/lib/sanity/client'
import { urlFor, SanityImage } from '@/lib/sanity/image'
import { allSpiritualLeadersQuery } from '@/lib/sanity/queries'
import { cn } from '@/lib/utils'
import { breadcrumbSchema } from '@/lib/structured-data'
import { GoldDivider, JsonLd, ScrollReveal } from '@/components/ui'

import type { SpiritualLeader } from '@/lib/sanity/types'

const fallbackDescription =
  "Meet the spiritual fathers who guide St. Basil's Syriac Orthodox Church in Boston, Massachusetts."

export async function generateMetadata(): Promise<Metadata> {
  const leaders = await sanityFetch<SpiritualLeader[]>({
    query: allSpiritualLeadersQuery,
    tags: ['spiritualLeader'],
    fallback: [],
  })

  const firstLeaderPhoto = leaders[0]?.photo

  return {
    title: 'Our Spiritual Fathers',
    description: fallbackDescription,
    openGraph: {
      title: "Our Spiritual Fathers | St. Basil's Syriac Orthodox Church",
      description: fallbackDescription,
      ...(firstLeaderPhoto
        ? { images: [urlFor(firstLeaderPhoto).width(1200).height(630).url()] }
        : {}),
    },
  }
}

export const revalidate = 60

export default async function SpiritualLeadersPage() {
  const leaders = await sanityFetch<SpiritualLeader[]>({
    query: allSpiritualLeadersQuery,
    tags: ['spiritualLeader'],
    fallback: [],
  })

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([{ name: 'Our Spiritual Fathers', path: '/spiritual-leaders' }])}
      />

      {/* Maroon Hero Banner */}
      <section className="flex h-[40vh] items-center justify-center bg-burgundy-700 md:h-[60vh]">
        <h1 className="animate-drop-in px-4 text-center font-heading text-[2.5rem] font-light leading-[1.1] text-cream-50 md:text-[4rem]">
          Our Spiritual Fathers
        </h1>
      </section>

      {/* Leaders */}
      {leaders.length > 0 ? (
        <section className="py-16 md:py-22 lg:py-28">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
            <div className="space-y-20 md:space-y-28">
              {leaders.map((leader, index) => {
                const imageFirst = index % 2 === 0

                return (
                  <ScrollReveal key={leader._id} direction="up">
                    <article
                      className={cn(
                        'flex flex-col gap-8 md:flex-row md:items-center md:gap-12 lg:gap-16',
                        !imageFirst && 'md:flex-row-reverse'
                      )}
                    >
                      {/* Photo */}
                      <div className="w-full md:w-5/12">
                        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl shadow-md">
                          <SanityImage
                            image={leader.photo}
                            alt={`Portrait of ${leader.name}`}
                            fill
                            sizes="(max-width: 768px) 100vw, 40vw"
                            lqip={leader.photoLqip}
                          />
                        </div>
                      </div>

                      {/* Text */}
                      <div className="w-full md:w-7/12">
                        <h2 className="font-heading text-[1.75rem] font-semibold leading-[1.3] text-wood-900 md:text-[2.25rem]">
                          {leader.name}
                        </h2>

                        <p className="mt-2 text-sm font-medium tracking-wide text-burgundy-700 uppercase">
                          {leader.title}
                        </p>

                        <GoldDivider className="my-5 mx-0" />

                        {leader.biography && (
                          <div className="space-y-4 text-base leading-relaxed text-wood-800">
                            <PortableText value={leader.biography} />
                          </div>
                        )}
                      </div>
                    </article>
                  </ScrollReveal>
                )
              })}
            </div>
          </div>
        </section>
      ) : (
        <section className="py-16 md:py-22 lg:py-28">
          <div className="mx-auto max-w-[1200px] px-4 text-center sm:px-6 lg:px-8">
            <p className="text-lg text-wood-800/60">
              Spiritual leader information is being updated. Please check back soon.
            </p>
          </div>
        </section>
      )}
    </>
  )
}
