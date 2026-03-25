import type { Metadata } from 'next'

import { sanityFetch } from '@/lib/sanity/client'
import { SanityImage } from '@/lib/sanity/image'
import { allOfficeBearersQuery } from '@/lib/sanity/queries'
import { SectionHeader, ScrollReveal } from '@/components/ui'

import type { OfficeBearer } from '@/lib/sanity/types'

const fallbackDescription =
  "Meet the office bearers of St. Basil's Syriac Orthodox Church — the executive committee and board members who serve our community."

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Our Office Bearers',
    description: fallbackDescription,
    openGraph: {
      title: "Our Office Bearers | St. Basil's Syriac Orthodox Church",
      description: fallbackDescription,
    },
  }
}

export const revalidate = 60

function groupBearersByCategory(bearers: OfficeBearer[]) {
  const executive: OfficeBearer[] = []
  const board: OfficeBearer[] = []

  for (const bearer of bearers) {
    if (bearer.category === 'executive') executive.push(bearer)
    else if (bearer.category === 'board') board.push(bearer)
  }

  return { executive, board }
}

export default async function OfficeBearersPage() {
  const bearers = await sanityFetch<OfficeBearer[]>({
    query: allOfficeBearersQuery,
    tags: ['officeBearer'],
  })

  const { executive, board } = groupBearersByCategory(bearers)
  const currentYear = new Date().getFullYear()

  return (
    <>
      {/* Maroon Hero */}
      <section className="relative flex h-[40vh] items-center justify-center bg-burgundy-700 md:h-[60vh]">
        <div className="absolute inset-0 bg-black/20" aria-hidden="true" />
        <div className="relative z-10 px-4 text-center">
          <h1 className="animate-drop-in font-heading text-[2.5rem] font-light leading-[1.1] text-cream-50 md:text-[4rem]">
            Our Office Bearers
          </h1>
          <p className="mt-4 animate-drop-in font-heading text-xl font-light tracking-wide text-cream-50/80 md:text-2xl">
            {currentYear}
          </p>
        </div>
      </section>

      {/* Executive Committee */}
      {executive.length > 0 && (
        <section className="py-16 md:py-22 lg:py-28">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
            <ScrollReveal direction="up">
              <SectionHeader
                title="Executive Committee"
                subtitle="Leading our parish with dedication and faith"
              />
            </ScrollReveal>

            <div className="mt-12 flex flex-wrap justify-center gap-8 md:gap-12">
              {executive.map((member, index) => (
                <ScrollReveal key={member._id} direction="up" delay={index * 0.12}>
                  <article className="group flex w-[280px] flex-col items-center rounded-2xl bg-sand p-8 text-center shadow transition-all duration-300 hover:-translate-y-1 hover:shadow-lg md:w-[320px]">
                    <div className="relative mb-6 h-[180px] w-[180px] overflow-hidden rounded-full border-4 border-cream-50 shadow-lg md:h-[220px] md:w-[220px]">
                      {member.photo ? (
                        <SanityImage
                          image={member.photo}
                          alt={`Portrait of ${member.name}`}
                          fill
                          sizes="220px"
                          lqip={member.photoLqip}
                          style={
                            member.photoPosition
                              ? { objectPosition: member.photoPosition }
                              : undefined
                          }
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-cream-100">
                          <span className="font-heading text-4xl text-wood-800/30">
                            {member.name.charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>

                    <h3 className="font-heading text-xl font-semibold text-wood-900 md:text-2xl">
                      {member.name}
                    </h3>
                    {member.role && (
                      <p className="mt-1 text-sm font-medium tracking-wide text-burgundy-700 italic">
                        {member.role}
                      </p>
                    )}
                  </article>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Board Members */}
      {board.length > 0 && (
        <section className="py-16 md:py-22 lg:py-28">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
            <ScrollReveal direction="up">
              <SectionHeader
                title="Board Members"
                subtitle="Serving faithfully in the governance of our parish"
              />
            </ScrollReveal>

            <div className="mt-12 grid grid-cols-1 justify-items-center gap-6 sm:grid-cols-2 md:gap-8 lg:grid-cols-3">
              {board.map((member, index) => (
                <ScrollReveal key={member._id} direction="up" delay={index * 0.12}>
                  <article className="group flex w-full max-w-[280px] flex-col items-center rounded-2xl bg-sand p-6 text-center shadow transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                    <div className="relative mb-4 h-[120px] w-[120px] overflow-hidden rounded-full border-3 border-cream-50 shadow md:h-[140px] md:w-[140px]">
                      {member.photo ? (
                        <SanityImage
                          image={member.photo}
                          alt={`Portrait of ${member.name}`}
                          fill
                          sizes="140px"
                          lqip={member.photoLqip}
                          style={
                            member.photoPosition
                              ? { objectPosition: member.photoPosition }
                              : undefined
                          }
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-cream-100">
                          <span className="font-heading text-2xl text-wood-800/30">
                            {member.name.charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>

                    <h3 className="font-heading text-lg font-semibold text-wood-900">
                      {member.name}
                    </h3>
                    {member.role && (
                      <p className="mt-1 text-sm text-burgundy-700 italic">
                        {member.role}
                      </p>
                    )}
                  </article>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Empty state */}
      {bearers.length === 0 && (
        <section className="py-16 md:py-22 lg:py-28">
          <div className="mx-auto max-w-[1200px] px-4 text-center sm:px-6 lg:px-8">
            <p className="text-lg text-wood-800/60">
              Office bearer information is being updated. Please check back soon.
            </p>
          </div>
        </section>
      )}
    </>
  )
}
