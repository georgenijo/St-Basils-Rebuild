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

export interface Clergy {
  _id: string
  name: string
  role?: string
  photo?: SanityImageSource
  photoPosition?: string
  photoLqip?: string
  yearsOfService?: string
  biography?: PortableTextBlock[]
  category: 'current' | 'previous' | 'memoriam'
  order: number
}

export interface SpiritualLeader {
  _id: string
  name: string
  title: string
  photo: SanityImageSource
  photoPosition?: string
  photoLqip?: string
  biography: PortableTextBlock[]
  order: number
}
