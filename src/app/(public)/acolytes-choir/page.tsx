import type { Metadata } from 'next'
import { PortableText } from 'next-sanity'

import { sanityFetch } from '@/lib/sanity/client'
import { urlFor, SanityImage } from '@/lib/sanity/image'
import { acolytesChoirPageQuery } from '@/lib/sanity/queries'
import { GoldDivider, ScrollReveal } from '@/components/ui'

import type { AcolytesChoirPage } from '@/lib/sanity/types'

const fallbackDescription =
  "Learn about the acolytes and choir of St. Basil's Syriac Orthodox Church in Boston."

export async function generateMetadata(): Promise<Metadata> {
  const page = await sanityFetch<AcolytesChoirPage | null>({
    query: acolytesChoirPageQuery,
    tags: ['acolytesChoirPage'],
  })

  const description = page?.metaDescription || fallbackDescription

  return {
    title: 'Our Acolytes & Choir',
    description,
    openGraph: {
      title: "Our Acolytes & Choir | St. Basil's Syriac Orthodox Church",
      description,
      ...(page?.heroImage
        ? { images: [urlFor(page.heroImage).width(1200).height(630).url()] }
        : {}),
    },
  }
}

export const revalidate = 60

const portableTextComponents = {
  marks: {
    burgundyHighlight: ({ children }: { children: React.ReactNode }) => (
      <strong className="font-semibold text-burgundy-700">{children}</strong>
    ),
  },
}

export default async function AcolytesChoirPage() {
  const page = await sanityFetch<AcolytesChoirPage | null>({
    query: acolytesChoirPageQuery,
    tags: ['acolytesChoirPage'],
  })

  const title = page?.pageTitle || 'Our Acolytes & Choir'

  return (
    <>
      {/* Parallax Hero */}
      <section className="relative flex h-[40vh] items-center justify-center overflow-hidden md:h-[60vh]">
        {page?.heroImage ? (
          <div
            className="absolute inset-0 bg-cover bg-fixed bg-center"
            style={{
              backgroundImage: `url(${urlFor(page.heroImage).width(1920).quality(80).auto('format').url()})`,
            }}
            aria-hidden="true"
          />
        ) : (
          <div className="absolute inset-0 bg-charcoal" aria-hidden="true" />
        )}
        <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
        <h1 className="relative z-10 animate-drop-in px-4 text-center font-heading text-[2.5rem] font-light leading-[1.1] text-cream-50 md:text-[4rem]">
          {title}
        </h1>
      </section>

      {/* Description */}
      {page?.description && (
        <section className="bg-cream-50 py-16 md:py-22 lg:py-28">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <ScrollReveal direction="up">
              <GoldDivider className="mb-8" />
              <div className="space-y-4 text-center text-base leading-relaxed text-wood-800 md:text-lg">
                <PortableText
                  value={page.description}
                  components={portableTextComponents}
                />
              </div>
              <GoldDivider className="mt-8" />
            </ScrollReveal>
          </div>
        </section>
      )}

      {/* Group Photo */}
      {page?.groupPhoto && (
        <section className="bg-sand py-16 md:py-22 lg:py-28">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
            <ScrollReveal direction="up">
              <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl shadow-lg">
                <SanityImage
                  image={page.groupPhoto}
                  alt={`${title} group photo`}
                  width={1200}
                  height={800}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 900px"
                  lqip={page.groupPhotoLqip}
                  className="w-full"
                />
              </div>
            </ScrollReveal>
          </div>
        </section>
      )}
    </>
  )
}
