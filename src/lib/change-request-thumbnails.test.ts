import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH, renderThumbnail } from './change-request-thumbnails'

function png(width: number, height: number) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 240, g: 230, b: 210 } },
  })
    .png()
    .toBuffer()
}

describe('renderThumbnail', () => {
  it('shrinks a tall full-page screenshot to a small WebP cropped from the top', async () => {
    const source = await png(1280, 6000)
    const thumbnail = await renderThumbnail(source)
    const meta = await sharp(thumbnail).metadata()

    expect(meta.format).toBe('webp')
    expect(meta.width).toBe(THUMBNAIL_WIDTH)
    expect(meta.height).toBe(THUMBNAIL_HEIGHT)
    expect(thumbnail.byteLength).toBeLessThan(source.byteLength)
  })

  it('never enlarges an image that is already small', async () => {
    const meta = await sharp(await renderThumbnail(await png(1, 1))).metadata()
    expect(meta.width).toBe(1)
    expect(meta.height).toBe(1)
  })

  it('rejects bytes that are not an image', async () => {
    await expect(renderThumbnail(new TextEncoder().encode('not an image'))).rejects.toThrow()
  })
})
