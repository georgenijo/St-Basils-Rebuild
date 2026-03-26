import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { sanityFetch } from '@/lib/sanity/client'
import { urlFor } from '@/lib/sanity/image'
import { pageContentBySlugQuery } from '@/lib/sanity/queries'
import { breadcrumbSchema } from '@/lib/structured-data'
import { JsonLd } from '@/components/ui'
import { LegalPageLayout } from '@/components/features/LegalPageLayout'

import type { PageContent } from '@/lib/sanity/types'

export const revalidate = 60

const fallbackDescription =
  "Privacy Policy for St. Basil's Syriac Orthodox Church website."

async function getPage() {
  return sanityFetch<PageContent | null>({
    query: pageContentBySlugQuery,
    params: { slug: 'privacy-policy' },
    tags: ['pageContent'],
  })
}

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage()

  const title = page?.title ?? 'Privacy Policy'
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

export default async function PrivacyPolicyPage() {
  const page = await getPage()

  if (!page) {
    notFound()
  }

  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'Privacy Policy', path: '/privacy-policy' }])} />
      <LegalPageLayout page={page} />
    </>
  )
}
