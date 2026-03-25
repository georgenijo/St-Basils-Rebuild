import type { PortableTextBlock } from 'next-sanity'
import type { SanityImageSource } from '@sanity/image-url'

export type { SanityImageSource }

export interface PageContent {
  _id: string
  title: string
  slug: { current: string }
  body: PortableTextBlock[]
}

export interface SanityFileAsset {
  _type: 'file'
  asset: {
    _ref: string
    _type: 'reference'
  }
}

export interface UsefulLink {
  _id: string
  title: string
  file?: SanityFileAsset
  category?: string
  order: number
}

export interface UsefulLinksPage {
  _id: string
  pageTitle: string
  heroImage?: SanityImageSource
  introText?: string
  sectionTitle?: string
}
