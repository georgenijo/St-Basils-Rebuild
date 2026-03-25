import type { PortableTextBlock } from 'next-sanity'
import type { SanityImageSource } from '@sanity/image-url'

export type { SanityImageSource }

export interface PageContent {
  _id: string
  title: string
  slug: { current: string }
  body: PortableTextBlock[]
}

export interface Organization {
  _id: string
  name: string
  slug: { current: string }
  photo?: SanityImageSource
  description?: PortableTextBlock[]
  missionStatement?: string
  scriptureQuote?: {
    text: string
    reference: string
  }
  externalLink?: string
  order: number
  backgroundColor?: string
}
