import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { sanityFetch } from '@/lib/sanity/client'
import { urlFor } from '@/lib/sanity/image'
import { generatePageContentMetadata } from '@/lib/sanity/metadata'
import { pageContentBySlugQuery } from '@/lib/sanity/queries'
import { PageHero } from '@/components/ui'

import type { PageContent } from '@/lib/sanity/types'

const SLUG = 'privacy-policy'

export async function generateMetadata(): Promise<Metadata> {
  return generatePageContentMetadata({
    slug: SLUG,
    fallbackTitle: 'Privacy Policy',
    fallbackDescription:
      "Privacy policy for St. Basil's Syriac Orthodox Church website.",
  })
}

export default async function PrivacyPolicyPage() {
  const page = await sanityFetch<PageContent | null>({
    query: pageContentBySlugQuery,
    params: { slug: SLUG },
    tags: [`pageContent:${SLUG}`],
  })

  if (!page) notFound()

  return (
    <>
      {page.heroStyle === 'parallax-image' && page.heroImage ? (
        <PageHero
          title={page.title}
          backgroundImage={urlFor(page.heroImage).auto('format').url()}
        />
      ) : (
        <section className="bg-burgundy-700 py-16 md:py-22">
          <h1 className="text-center font-heading text-[2.5rem] font-light leading-[1.1] text-cream-50 md:text-[4rem]">
            {page.title}
          </h1>
        </section>
      )}
    </>
  )
}
