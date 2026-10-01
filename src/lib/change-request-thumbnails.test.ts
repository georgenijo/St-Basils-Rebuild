import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { THUMBNAIL_MAX_HEIGHT, THUMBNAIL_WIDTH, renderThumbnail } from './change-request-thumbnails'

function png(width: number, height: number) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 240, g: 230, b: 210 } },
  })
    .png()
    .toBuffer()
}

/** Landscape image with solid red / blue bands on its left and right edges. */
async function landscapeWithEdgeMarkers() {
  const marker = (r: number, b: number) =>
    sharp({ create: { width: 100, height: 900, channels: 3, background: { r, g: 0, b } } })
      .png()
      .toBuffer()
  return sharp({
    create: { width: 1600, height: 900, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .composite([
      { input: await marker(255, 0), left: 0, top: 0 },
      { input: await marker(0, 255), left: 1500, top: 0 },
    ])
    .png()
    .toBuffer()
}

async function pixel(image: Buffer, x: number, y: number) {
  const { data, info } = await sharp(image).raw().toBuffer({ resolveWithObject: true })
  const offset = (y * info.width + x) * info.channels
  return [data[offset], data[offset + 1], data[offset + 2]]
}

describe('renderThumbnail', () => {
  it('shrinks a tall full-page screenshot to a small WebP, keeping only the top', async () => {
    const source = await png(1280, 6000)
    const thumbnail = await renderThumbnail(source)
    const meta = await sharp(thumbnail).metadata()

    expect(meta.format).toBe('webp')
    expect(meta.width).toBe(THUMBNAIL_WIDTH)
    expect(meta.height).toBe(THUMBNAIL_MAX_HEIGHT)
    expect(thumbnail.byteLength).toBeLessThan(source.byteLength)
  })

  it('keeps the full width and aspect ratio of landscape images', async () => {
    const thumbnail = await renderThumbnail(await landscapeWithEdgeMarkers())
    const meta = await sharp(thumbnail).metadata()

    expect([meta.width, meta.height]).toEqual([640, 360])
    const [leftRed, , leftBlue] = await pixel(thumbnail, 5, 180)
    const [rightRed, , rightBlue] = await pixel(thumbnail, 634, 180)
    expect(leftRed).toBeGreaterThan(200)
    expect(leftBlue).toBeLessThan(60)
    expect(rightBlue).toBeGreaterThan(200)
    expect(rightRed).toBeLessThan(60)
  })

  it('never enlarges an image that is already small', async () => {
    const square = await sharp(await renderThumbnail(await png(300, 300))).metadata()
    expect([square.width, square.height]).toEqual([300, 300])
    const tiny = await sharp(await renderThumbnail(await png(1, 1))).metadata()
    expect([tiny.width, tiny.height]).toEqual([1, 1])
  })

  it('rejects bytes that are not an image', async () => {
    await expect(renderThumbnail(new TextEncoder().encode('not an image'))).rejects.toThrow()
  })
})
