import type { PortableTextBlock } from 'next-sanity'
import type { SanityImageSource } from '@sanity/image-url'

export type { SanityImageSource }

export interface PageContent {
  _id: string
  title: string
  slug: { current: string }
  heroStyle: 'maroon-banner' | 'parallax-image'
  heroImage?: SanityImageSource
  body: PortableTextBlock[]
  metaDescription?: string
  effectiveDate?: string
  lastUpdated?: string
}

export interface AcolytesChoirPage {
  _id: string
  heroImage: SanityImageSource
  body: PortableTextBlock[]
  groupPhoto?: SanityImageSource
  groupPhotoAlt?: string
  metaDescription?: string
}
