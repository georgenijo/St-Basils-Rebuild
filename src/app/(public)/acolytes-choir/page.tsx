import type { Metadata } from 'next'
import { PortableText } from 'next-sanity'

import { sanityFetch } from '@/lib/sanity/client'
import { urlFor, SanityImage } from '@/lib/sanity/image'
import { acolytesChoirPageQuery } from '@/lib/sanity/queries'
import { PageHero, ScrollReveal } from '@/components/ui'

import type { AcolytesChoirPage } from '@/lib/sanity/types'
import type { PortableTextComponents } from 'next-sanity'

export const revalidate = 60

const portableTextComponents: PortableTextComponents = {
  marks: {
    strong: ({ children }) => (
      <strong className="font-semibold text-burgundy-700">{children}</strong>
    ),
    em: ({ children }) => <em>{children}</em>,
    link: ({ value, children }) => (
      <a
        href={value?.href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-burgundy-700 underline underline-offset-4 hover:text-burgundy-800"
      >
        {children}
      </a>
    ),
  },
  block: {
    normal: ({ children }) => (
      <p className="text-base leading-relaxed text-wood-800">{children}</p>
    ),
  },
}

async function getData() {
  return sanityFetch<AcolytesChoirPage | null>({
    query: acolytesChoirPageQuery,
    tags: ['acolytesChoirPage'],
  })
}

export async function generateMetadata(): Promise<Metadata> {
  const data = await getData()

  return {
    title: 'Our Acolytes & Choir',
    description:
      data?.metaDescription ??
      "Meet the acolytes and choir of St. Basil's Syriac Orthodox Church in Boston.",
    openGraph: {
      title: "Our Acolytes & Choir | St. Basil's Syriac Orthodox Church",
      description:
        data?.metaDescription ??
        "Meet the acolytes and choir of St. Basil's Syriac Orthodox Church in Boston.",
      ...(data?.heroImage && {
        images: [urlFor(data.heroImage).width(1200).height(630).url()],
      }),
    },
  }
}

export default async function AcolytesChoirPage() {
  const data = await getData()

  const heroImageUrl = data?.heroImage
    ? urlFor(data.heroImage).width(1920).quality(80).url()
    : '/images/about/church-exterior.jpg'

  return (
    <>
      {/* Parallax Hero */}
      <PageHero title="Our Acolytes & Choir" backgroundImage={heroImageUrl} />

      {/* Description */}
      {data?.body && (
        <section className="py-16 md:py-22 lg:py-28">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="mx-auto max-w-3xl space-y-6">
                <PortableText value={data.body} components={portableTextComponents} />
              </div>
            </ScrollReveal>
          </div>
        </section>
      )}

      {/* Group Photo */}
      {data?.groupPhoto && (
        <section className="pb-16 md:pb-22 lg:pb-28">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="mx-auto max-w-3xl">
                <div className="relative aspect-[3/2] overflow-hidden rounded-2xl shadow-lg">
                  <SanityImage
                    image={data.groupPhoto}
                    alt={data.groupPhotoAlt ?? 'Acolytes and choir group photo'}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 768px"
                  />
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>
      )}
    </>
  )
}
