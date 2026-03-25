import type { PortableTextBlock } from 'next-sanity'
import type { SanityImageSource } from '@sanity/image-url'

export type { SanityImageSource }

export interface PageContent {
  _id: string
  title: string
  slug: { current: string }
  body: PortableTextBlock[]
}

export interface OfficeBearer {
  _id: string
  name: string
  role?: string
  photo?: SanityImageSource
  photoPosition?: string
  category: 'executive' | 'board'
  year?: string
  order: number
}
