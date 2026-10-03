import { test, expect, type Request } from '@playwright/test'

/**
 * Smoke: No public page downloads an oversized image (#320).
 *
 * Hero photos served as raw CSS backgrounds shipped multi-megabyte originals to
 * phones. Every image the browser fetches on a public page, including lazy
 * images below the fold, must stay within the per-image byte budget.
 */

const MAX_IMAGE_BYTES = 500 * 1024

const PUBLIC_PAGES = [
  '/',
  '/about',
  '/spiritual-leaders',
  '/our-clergy',
  '/office-bearers',
  '/acolytes-choir',
  '/our-organizations',
  '/events',
  '/announcements',
  '/useful-links',
  '/first-time',
  '/giving',
  '/contact',
  '/privacy-policy',
  '/terms-of-use',
]

test.describe('Image weight @smoke', () => {
  for (const path of PUBLIC_PAGES) {
    test(`no image over 500 KB on ${path}`, async ({ page }) => {
      const sizes: Promise<{ url: string; bytes: number }>[] = []

      page.on('requestfinished', (request: Request) => {
        if (request.resourceType() !== 'image') return
        sizes.push(
          request.sizes().then(({ responseBodySize }) => ({
            url: request.url(),
            bytes: responseBodySize,
          }))
        )
      })

      await page.goto(path, { waitUntil: 'load' })

      // Bring lazy images into view so they are fetched and measured too.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight / 2) {
          window.scrollTo(0, y)
          await new Promise((resolve) => setTimeout(resolve, 50))
        }
      })
      await expect
        .poll(() =>
          page
            .locator('img')
            .evaluateAll((images) => images.every((image) => (image as HTMLImageElement).complete))
        )
        .toBe(true)

      const measured = await Promise.all(sizes)
      expect(measured.length).toBeGreaterThan(0)

      const oversized = measured
        .filter(({ bytes }) => bytes > MAX_IMAGE_BYTES)
        .map(({ url, bytes }) => `${Math.round(bytes / 1024)} KB ${new URL(url).pathname}`)
      expect(oversized).toEqual([])
    })
  }
})
