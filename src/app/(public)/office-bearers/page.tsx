import type { Metadata } from 'next'

import { sanityFetch } from '@/lib/sanity/client'
import { urlFor } from '@/lib/sanity/image'
import { officeBearersQuery } from '@/lib/sanity/queries'
import { SectionHeader, ScrollReveal } from '@/components/ui'
import { OfficeBearerCard } from '@/components/features/OfficeBearerCard'

import type { OfficeBearer } from '@/lib/sanity/types'

export const metadata: Metadata = {
  title: 'Office Bearers',
  description:
    "Meet the office bearers of St. Basil's Syriac Orthodox Church in Boston. Our executive committee and board members serve the parish with dedication and faith.",
  openGraph: {
    title: "Office Bearers | St. Basil's Syriac Orthodox Church",
    description:
      "Meet the office bearers of St. Basil's Syriac Orthodox Church in Boston.",
  },
}

export const revalidate = 60

export default async function OfficeBearersPage() {
  const bearers = await sanityFetch<OfficeBearer[]>({
    query: officeBearersQuery,
    tags: ['officeBearer'],
  })

  const currentYear = new Date().getFullYear()
  const executive = bearers.filter((b) => b.category === 'executive')
  const board = bearers.filter((b) => b.category === 'board')

  return (
    <main>
      {/* Hero — maroon banner with dynamic year */}
      <section className="flex h-[40vh] items-center justify-center bg-burgundy-700 md:h-[60vh]">
        <div className="px-4 text-center">
          <h1 className="animate-drop-in font-heading text-[2.5rem] font-light leading-[1.1] text-cream-50 md:text-[4rem]">
            Our Office Bearers
          </h1>
          <p className="mt-4 animate-drop-in font-body text-lg text-cream-50/80 [animation-delay:0.15s]">
            {currentYear}
          </p>
        </div>
      </section>

      {/* Executive Committee */}
      {executive.length > 0 && (
        <section className="py-16 md:py-22 lg:py-28">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <SectionHeader
                title="Executive Committee"
                subtitle="The executive committee guides the parish's administrative affairs and spiritual mission."
              />
            </ScrollReveal>

            <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {executive.map((bearer, i) => (
                <ScrollReveal key={bearer._id} delay={i * 0.12}>
                  <OfficeBearerCard
                    name={bearer.name}
                    role={bearer.role}
                    photoUrl={bearer.photo ? urlFor(bearer.photo).width(400).height(480).auto('format').url() : undefined}
                    variant="executive"
                  />
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Board Members */}
      {board.length > 0 && (
        <section className="bg-sand py-16 md:py-22 lg:py-28">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <SectionHeader
                title="Board Members"
                subtitle="Our board members dedicate their time and talents to serving the parish community."
              />
            </ScrollReveal>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {board.map((bearer, i) => (
                <ScrollReveal key={bearer._id} delay={i * 0.08}>
                  <OfficeBearerCard
                    name={bearer.name}
                    role={bearer.role}
                    photoUrl={bearer.photo ? urlFor(bearer.photo).width(300).height(360).auto('format').url() : undefined}
                    variant="board"
                  />
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Empty state */}
      {bearers.length === 0 && (
        <section className="py-16 md:py-22 lg:py-28">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <p className="font-body text-base text-wood-800/60">
              Office bearer information will be available soon.
            </p>
          </div>
        </section>
      )}
    </main>
  )
}
