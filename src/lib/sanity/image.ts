import { createImageUrlBuilder } from '@sanity/image-url'

import { client } from '@/lib/sanity/client'

import type { SanityImageSource } from '@/lib/sanity/types'

const builder = createImageUrlBuilder(client)

export function urlFor(source: SanityImageSource) {
  return builder.image(source)
}
