import type { PortableTextBlock } from 'next-sanity'
import type { SanityImageSource } from '@sanity/image-url'

export type { SanityImageSource }

export interface PageContent {
  _id: string
  title: string
  slug: { current: string }
  body: PortableTextBlock[]
}

export interface AcolytesChoirPage {
  _id: string
  pageTitle: string
  heroImage: SanityImageSource
  description: PortableTextBlock[]
  groupPhoto?: SanityImageSource
  metaDescription?: string
}
