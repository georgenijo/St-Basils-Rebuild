import type { PortableTextBlock } from 'next-sanity'
import type { SanityImageSource } from '@sanity/image-url'

export type { SanityImageSource }

export interface PageContent {
  _id: string
  title: string
  slug: { current: string }
  body: PortableTextBlock[]
}

export interface SpiritualLeader {
  _id: string
  name: string
  title: string
  photo: SanityImageSource
  photoPosition?: string
  biography: PortableTextBlock[]
  order: number
}
