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
  "Privacy Policy for St. Basil's Syriac Orthodox Church website."

const fallbackPage: PageContent = {
  _id: 'fallback-privacy-policy',
  title: 'Privacy Policy',
  slug: { current: 'privacy-policy' },
  heroStyle: 'maroon-banner',
  body: [
    {
      _type: 'block',
      style: 'normal',
      markDefs: [],
      children: [
        {
          _type: 'span',
          text: 'This website collects only the information needed to respond to inquiries, process newsletter signups, and provide core parish communications.',
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
          text: 'If you contact the church or subscribe to updates, your information is used only for those church-related purposes and is not sold to third parties.',
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
    params: { slug: 'privacy-policy' },
    tags: ['pageContent'],
    fallback: fallbackPage,
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

  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'Privacy Policy', path: '/privacy-policy' }])} />
      <LegalPageLayout page={page} />
    </>
  )
}
