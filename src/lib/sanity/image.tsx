import Image, { type ImageProps } from 'next/image'

import { createImageUrlBuilder } from '@sanity/image-url'

import { client } from '@/lib/sanity/client'
import { cn } from '@/lib/utils'

import type { SanityImageSource } from '@/lib/sanity/types'

const builder = createImageUrlBuilder(client)

export function urlFor(source: SanityImageSource) {
  return builder.image(source)
}

function sanityLoader({
  src,
  width,
  quality,
}: {
  src: string
  width: number
  quality?: number
}): string {
  const url = new URL(src)
  url.searchParams.set('w', width.toString())
  url.searchParams.set('q', (quality || 75).toString())
  url.searchParams.set('auto', 'format')
  return url.toString()
}

function getHotspotPosition(image: SanityImageSource): string | undefined {
  if (typeof image === 'object' && 'hotspot' in image && image.hotspot) {
    const { x, y } = image.hotspot
    return `${x * 100}% ${y * 100}%`
  }
  return undefined
}

export interface SanityImageProps extends Omit<ImageProps, 'src'> {
  image: SanityImageSource
  lqip?: string
}

export function SanityImage({
  image,
  alt,
  lqip,
  className,
  style,
  ...props
}: SanityImageProps) {
  const imageUrl = urlFor(image).auto('format').url()
  const hotspotPosition = getHotspotPosition(image)

  return (
    <Image
      src={imageUrl}
      loader={sanityLoader}
      alt={alt}
      className={cn('object-cover', className)}
      style={{
        ...style,
        ...(hotspotPosition ? { objectPosition: hotspotPosition } : {}),
      }}
      {...(lqip ? { placeholder: 'blur' as const, blurDataURL: lqip } : {})}
      {...props}
    />
  )
}
