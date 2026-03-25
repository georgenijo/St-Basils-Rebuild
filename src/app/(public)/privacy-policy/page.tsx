import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { sanityFetch } from '@/lib/sanity/client'
import { pageContentBySlugQuery } from '@/lib/sanity/queries'
import { LegalPageLayout } from '@/components/features/LegalPageLayout'

import type { PageContent } from '@/lib/sanity/types'

export const revalidate = 60

async function getPage() {
  return sanityFetch<PageContent | null>({
    query: pageContentBySlugQuery,
    params: { slug: 'privacy-policy' },
    tags: ['pageContent'],
  })
}

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage()

  return {
    title: page?.title ?? 'Privacy Policy',
    description:
      page?.metaDescription ??
      "Privacy Policy for St. Basil's Syriac Orthodox Church website.",
  }
}

export default async function PrivacyPolicyPage() {
  const page = await getPage()

  if (!page) {
    notFound()
  }

  return <LegalPageLayout page={page} />
}
