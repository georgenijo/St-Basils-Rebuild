import 'server-only'

import sharp from 'sharp'

/** 2x the widest gallery tile (~320 CSS px). */
export const THUMBNAIL_WIDTH = 640
/**
 * Tall full-page screenshots keep only their top (matching the tiles'
 * `object-position: top`); every other image keeps its aspect ratio.
 */
export const THUMBNAIL_MAX_HEIGHT = 960

/**
 * Downscale a stored image to a small WebP: proportional resize to at most
 * THUMBNAIL_WIDTH wide (never enlarging), then crop only the height beyond
 * THUMBNAIL_MAX_HEIGHT so no side content is lost.
 */
export async function renderThumbnail(input: Uint8Array): Promise<Buffer> {
  const image = sharp(input, { limitInputPixels: 64_000_000 }).rotate()
  const meta = await image.metadata()
  // autoOrient reports the dimensions after EXIF rotation.
  const width = meta.autoOrient?.width ?? meta.width
  const height = meta.autoOrient?.height ?? meta.height
  if (!width || !height) throw new Error('Unreadable image dimensions')

  const scale = Math.min(1, THUMBNAIL_WIDTH / width)
  const outWidth = Math.max(1, Math.round(width * scale))
  const outHeight = Math.max(1, Math.round(height * scale))

  image.resize({ width: outWidth, height: outHeight, fit: 'fill' })
  if (outHeight > THUMBNAIL_MAX_HEIGHT) {
    image.extract({ left: 0, top: 0, width: outWidth, height: THUMBNAIL_MAX_HEIGHT })
  }
  return image.webp({ quality: 72 }).toBuffer()
}
