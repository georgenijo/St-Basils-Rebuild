import type { Metadata } from 'next'
import { PortableText } from 'next-sanity'

import { sanityFetch } from '@/lib/sanity/client'
import { SanityImage } from '@/lib/sanity/image'
import { allClergyQuery } from '@/lib/sanity/queries'
import { cn } from '@/lib/utils'
import { SectionHeader, ScrollReveal } from '@/components/ui'
import { CandleFlame } from '@/components/features/CandleFlame'

import type { Clergy } from '@/lib/sanity/types'

const fallbackDescription =
  "Meet the clergy of St. Basil's Syriac Orthodox Church in Boston — past and present servants who have shepherded our community."

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Our Clergy',
    description: fallbackDescription,
    openGraph: {
      title: "Our Clergy | St. Basil's Syriac Orthodox Church",
      description: fallbackDescription,
      images: ['/images/our-clergy-hero.jpg'],
    },
  }
}

export const revalidate = 60

function groupClergyByCategory(clergy: Clergy[]) {
  const current: Clergy[] = []
  const previous: Clergy[] = []
  const memoriam: Clergy[] = []

  for (const member of clergy) {
    if (member.category === 'current') current.push(member)
    else if (member.category === 'previous') previous.push(member)
    else if (member.category === 'memoriam') memoriam.push(member)
  }

  return { current, previous, memoriam }
}

export default async function OurClergyPage() {
  const clergy = await sanityFetch<Clergy[]>({
    query: allClergyQuery,
    tags: ['clergy'],
  })

  const { current, previous, memoriam } = groupClergyByCategory(clergy)

  return (
    <>
      {/* Fixed Background Hero */}
      <section className="relative flex h-[40vh] items-center justify-center overflow-hidden md:h-[60vh]">
        <div
          className="absolute inset-0 bg-cover bg-fixed bg-center"
          style={{ backgroundImage: "url('/images/our-clergy-hero.jpg')" }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
        <h1 className="relative z-10 animate-drop-in px-4 text-center font-heading text-[2.5rem] font-light leading-[1.1] text-cream-50 md:text-[4rem]">
          Our Clergy
        </h1>
      </section>

      {/* Current Clergy */}
      {current.length > 0 && (
        <section className="py-16 md:py-22 lg:py-28">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
            <ScrollReveal direction="up">
              <SectionHeader
                title="Our Current Clergy"
                subtitle="Faithfully serving our community today"
              />
            </ScrollReveal>

            <div
              className={cn(
                'mt-12 flex flex-wrap justify-center gap-8 md:gap-12',
                current.length <= 2 && 'md:gap-16 lg:gap-20'
              )}
            >
              {current.map((member, index) => (
                <ScrollReveal key={member._id} direction="up" delay={index * 0.15}>
                  <article className="group flex w-[280px] flex-col items-center text-center md:w-[320px]">
                    {/* Circular photo */}
                    <div className="relative mb-6 h-[220px] w-[220px] overflow-hidden rounded-full border-4 border-cream-50 shadow-lg transition-shadow duration-300 group-hover:shadow-xl md:h-[260px] md:w-[260px]">
                      {member.photo ? (
                        <SanityImage
                          image={member.photo}
                          alt={`Portrait of ${member.name}`}
                          fill
                          sizes="260px"
                          lqip={member.photoLqip}
                          style={
                            member.photoPosition
                              ? { objectPosition: member.photoPosition }
                              : undefined
                          }
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-sand">
                          <span className="font-heading text-4xl text-wood-800/30">
                            {member.name.charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Name & role */}
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

      {/* Transition: heritage divider */}
      {current.length > 0 && previous.length > 0 && (
        <div className="mx-auto max-w-[600px] px-4 text-center">
          <ScrollReveal direction="up">
            <p className="mb-6 font-heading text-lg font-medium text-burgundy-700 italic md:text-xl">
              Our Heritage of Faithful Leadership
            </p>
            <div className="relative h-[2px] w-full bg-gradient-to-r from-transparent via-burgundy-700 to-transparent">
              <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-burgundy-700" />
            </div>
          </ScrollReveal>
        </div>
      )}

      {/* Previous Clergy */}
      {previous.length > 0 && (
        <section className="py-16 md:py-22 lg:py-28">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
            <ScrollReveal direction="up">
              <SectionHeader
                title="Our Previous Clergy"
                subtitle="We honor those who built our community, each bringing their unique gifts and leaving an indelible mark on our spiritual journey."
              />
            </ScrollReveal>

            <div className="mt-12 grid grid-cols-1 justify-items-center gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {previous.map((member, index) => (
                <ScrollReveal key={member._id} direction="up" delay={index * 0.12}>
                  <article className="group flex w-full max-w-[320px] flex-col items-center rounded-2xl bg-sand p-8 text-center shadow transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                    {/* Circular photo */}
                    <div className="relative mb-4 h-[160px] w-[160px] overflow-hidden rounded-full border-3 border-cream-50 shadow md:h-[180px] md:w-[180px]">
                      {member.photo ? (
                        <SanityImage
                          image={member.photo}
                          alt={`Portrait of ${member.name}`}
                          fill
                          sizes="180px"
                          lqip={member.photoLqip}
                          style={
                            member.photoPosition
                              ? { objectPosition: member.photoPosition }
                              : undefined
                          }
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-cream-100">
                          <span className="font-heading text-3xl text-wood-800/30">
                            {member.name.charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Name & details */}
                    <h3 className="font-heading text-lg font-semibold text-wood-900">
                      {member.name}
                    </h3>
                    {(member.role || member.yearsOfService) && (
                      <p className="mt-1 text-sm text-burgundy-700 italic">
                        {member.role}
                        {member.role && member.yearsOfService && <br />}
                        {member.yearsOfService}
                      </p>
                    )}
                  </article>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* In Memoriam */}
      {memoriam.length > 0 && (
        <section className="py-16 md:py-22 lg:py-28">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
            <ScrollReveal direction="up">
              <SectionHeader title="In Memoriam" />
            </ScrollReveal>

            <div className="mt-12 space-y-16">
              {memoriam.map((member) => (
                <ScrollReveal key={member._id} direction="up">
                  <article className="mx-auto max-w-[560px]">
                    {/* Memorial card with candles */}
                    <div className="relative rounded-2xl bg-sand p-10 text-center shadow-md sm:p-12">
                      {/* Candles — hidden on small screens */}
                      <div className="pointer-events-none absolute left-4 top-1/2 hidden -translate-y-1/2 sm:block">
                        <CandleFlame />
                      </div>
                      <div className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 sm:block">
                        <CandleFlame />
                      </div>

                      {/* Photo */}
                      <div className="relative mx-auto mb-6 h-[220px] w-[220px] overflow-hidden rounded-full border-[5px] border-cream-50 shadow-lg md:h-[280px] md:w-[280px]">
                        {member.photo ? (
                          <SanityImage
                            image={member.photo}
                            alt={`Portrait of ${member.name}`}
                            fill
                            sizes="280px"
                            lqip={member.photoLqip}
                            style={
                              member.photoPosition
                                ? { objectPosition: member.photoPosition }
                                : undefined
                            }
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-cream-100">
                            <span className="font-heading text-5xl text-wood-800/30">
                              {member.name.charAt(0)}
                            </span>
                          </div>
                        )}
                      </div>

                      <h3 className="font-heading text-xl font-semibold text-burgundy-700 md:text-2xl">
                        In Loving Memory
                      </h3>
                      <h4 className="mt-2 font-heading text-lg font-semibold text-wood-900 md:text-xl">
                        {member.name}
                      </h4>
                      {member.role && (
                        <p className="mt-1 text-sm text-wood-800/60 italic">{member.role}</p>
                      )}
                    </div>

                    {/* Biography below card */}
                    {member.biography && member.biography.length > 0 && (
                      <div className="mt-8 space-y-4 text-base leading-relaxed text-wood-800">
                        <PortableText value={member.biography} />
                      </div>
                    )}

                    {/* Closing prayer */}
                    <ScrollReveal direction="up" delay={0.3}>
                      <p className="mt-8 text-center font-heading text-lg font-medium text-burgundy-700 italic md:text-xl">
                        May his soul rest in peace in the embrace of our Lord.
                      </p>
                    </ScrollReveal>
                  </article>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Empty state */}
      {clergy.length === 0 && (
        <section className="py-16 md:py-22 lg:py-28">
          <div className="mx-auto max-w-[1200px] px-4 text-center sm:px-6 lg:px-8">
            <p className="text-lg text-wood-800/60">
              Clergy information is being updated. Please check back soon.
            </p>
          </div>
        </section>
      )}
    </>
  )
}
