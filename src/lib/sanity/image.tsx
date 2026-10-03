import Image, { type ImageProps } from 'next/image'

import { createImageUrlBuilder } from '@sanity/image-url'

import { getSanityClient, hasSanityConfig } from '@/lib/sanity/client'
import { cn } from '@/lib/utils'

import type { SanityImageSource } from '@/lib/sanity/types'

const builder = hasSanityConfig ? createImageUrlBuilder(getSanityClient()) : null

export function urlFor(source: SanityImageSource) {
  if (!builder) {
    throw new Error('Sanity image URLs are unavailable because Sanity is not configured')
  }
  return builder.image(source)
}

export function getHotspotPosition(image: SanityImageSource): string | undefined {
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

export function SanityImage({ image, alt, lqip, className, style, ...props }: SanityImageProps) {
  const imageUrl = urlFor(image).auto('format').url()
  const hotspotPosition = getHotspotPosition(image)

  return (
    <Image
      src={imageUrl}
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
