import { test, expect } from '@playwright/test'

/**
 * Smoke: All images load without errors.
 *
 * Navigates to key pages and checks for broken images
 * (images that fail to load or have naturalWidth of 0).
 */

const PAGES_WITH_IMAGES = ['/', '/about', '/contact', '/giving', '/first-time']

test.describe('Image loading @smoke', () => {
  for (const path of PAGES_WITH_IMAGES) {
    test(`all images load on ${path}`, async ({ page }) => {
      const failedImages: string[] = []

      // Track failed image requests
      page.on('response', (response) => {
        const url = response.url()
        const isImage =
          url.match(/\.(png|jpe?g|gif|webp|avif|svg|ico)(\?|$)/i) ||
          response.request().resourceType() === 'image'

        if (isImage && response.status() >= 400) {
          failedImages.push(`${response.status()} ${url}`)
        }
      })

      await page.goto(path, { waitUntil: 'networkidle' })

      // Check for broken images in the DOM
      const brokenImages = await page.evaluate(() => {
        const images = document.querySelectorAll('img')
        const broken: string[] = []
        images.forEach((img) => {
          // Skip lazy images that haven't loaded yet
          if (img.loading === 'lazy' && !img.complete) return
          // Skip tiny tracking pixels
          if (img.width <= 1 && img.height <= 1) return

          if (img.complete && img.naturalWidth === 0) {
            broken.push(img.src || img.dataset.src || 'unknown')
          }
        })
        return broken
      })

      expect(failedImages).toEqual([])
      expect(brokenImages).toEqual([])
    })
  }

  test('logo image loads in navbar', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    const logo = page.locator('nav img[alt="St. Basil\'s Syriac Orthodox Church"]')
    await expect(logo).toBeVisible()

    // Verify natural dimensions (not broken)
    const naturalWidth = await logo.evaluate((img: HTMLImageElement) => img.naturalWidth)
    expect(naturalWidth).toBeGreaterThan(0)
  })
})
