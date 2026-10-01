import 'server-only'

import sharp from 'sharp'

/**
 * 2x the widest gallery tile (~320 CSS px). Tall full-page screenshots are
 * cropped from the top, matching the tiles' `object-position: top`.
 */
export const THUMBNAIL_WIDTH = 640
export const THUMBNAIL_HEIGHT = 800

/** Downscale a stored image to a small WebP; never enlarges small images. */
export async function renderThumbnail(input: Uint8Array): Promise<Buffer> {
  return sharp(input, { limitInputPixels: 64_000_000 })
    .rotate()
    .resize({
      width: THUMBNAIL_WIDTH,
      height: THUMBNAIL_HEIGHT,
      fit: 'cover',
      position: 'top',
      withoutEnlargement: true,
    })
    .webp({ quality: 72 })
    .toBuffer()
}
