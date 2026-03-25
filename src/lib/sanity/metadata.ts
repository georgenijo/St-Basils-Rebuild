import type { Metadata } from 'next'

import { sanityFetch } from '@/lib/sanity/client'
import { urlFor } from '@/lib/sanity/image'
import { pageContentBySlugQuery } from '@/lib/sanity/queries'

import type { PageContent } from '@/lib/sanity/types'

const SITE_NAME = "St. Basil's Syriac Orthodox Church"

interface PageContentMetadataConfig {
  slug: string
  fallbackTitle: string
  fallbackDescription: string
}

export async function generatePageContentMetadata({
  slug,
  fallbackTitle,
  fallbackDescription,
}: PageContentMetadataConfig): Promise<Metadata> {
  const page = await sanityFetch<PageContent | null>({
    query: pageContentBySlugQuery,
    params: { slug },
    tags: [`pageContent:${slug}`],
  })

  const title = page?.title ?? fallbackTitle
  const description = page?.metaDescription ?? fallbackDescription

  const metadata: Metadata = {
    title,
    description,
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
    },
  }

  if (page?.heroImage) {
    const ogImageUrl = urlFor(page.heroImage)
      .width(1200)
      .height(630)
      .fit('crop')
      .auto('format')
      .url()

    metadata.openGraph = {
      ...metadata.openGraph,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    }
  }

  return metadata
}
