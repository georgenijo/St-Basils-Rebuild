import type { Metadata } from 'next'
import { sanityFetch } from '@/lib/sanity/client'
import { urlFor } from '@/lib/sanity/image'
import { pageContentBySlugQuery } from '@/lib/sanity/queries'
import { breadcrumbSchema } from '@/lib/structured-data'
import { JsonLd } from '@/components/ui'
import { LegalPageLayout } from '@/components/features/LegalPageLayout'

import type { PageContent } from '@/lib/sanity/types'

export const revalidate = 60

const fallbackDescription =
  "Terms of Use for St. Basil's Syriac Orthodox Church website."

const fallbackPage: PageContent = {
  _id: 'fallback-terms-of-use',
  title: 'Terms of Use',
  slug: { current: 'terms-of-use' },
  heroStyle: 'maroon-banner',
  body: [
    {
      _type: 'block',
      style: 'normal',
      markDefs: [],
      children: [
        {
          _type: 'span',
          text: 'This website is provided to share information about the parish, its ministries, and its public events. Please use the site lawfully and respectfully.',
          marks: [],
        },
      ],
    },
    {
      _type: 'block',
      style: 'normal',
      markDefs: [],
      children: [
        {
          _type: 'span',
          text: 'Content may be updated as parish schedules, ministries, and policies change. For official guidance on any church matter, please contact the parish directly.',
          marks: [],
        },
      ],
    },
  ],
  metaDescription: fallbackDescription,
}

async function getPage() {
  return sanityFetch<PageContent>({
    query: pageContentBySlugQuery,
    params: { slug: 'terms-of-use' },
    tags: ['pageContent'],
    fallback: fallbackPage,
  })
}

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage()

  const title = page?.title ?? 'Terms of Use'
  const description = page?.metaDescription ?? fallbackDescription

  return {
    title,
    description,
    openGraph: {
      title: `${title} | St. Basil's Syriac Orthodox Church`,
      description,
      ...(page?.heroImage
        ? { images: [urlFor(page.heroImage).width(1200).height(630).url()] }
        : {}),
    },
  }
}

export default async function TermsOfUsePage() {
  const page = await getPage()

  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'Terms of Use', path: '/terms-of-use' }])} />
      <LegalPageLayout page={page} />
    </>
  )
}
