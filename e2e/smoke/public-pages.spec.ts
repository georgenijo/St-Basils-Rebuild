import { test, expect } from '@playwright/test'

/**
 * Smoke: Every public page loads without errors.
 *
 * Verifies each route returns 200, renders the <nav> and <footer>,
 * and produces no console errors.
 */

const PUBLIC_PAGES: { path: string; label: string }[] = [
  { path: '/', label: 'Homepage' },
  { path: '/about', label: 'About / Our History' },
  { path: '/spiritual-leaders', label: 'Our Spiritual Fathers' },
  { path: '/our-clergy', label: 'Our Clergy' },
  { path: '/office-bearers', label: 'Office Bearers' },
  { path: '/acolytes-choir', label: 'Acolytes & Choir' },
  { path: '/our-organizations', label: 'Our Organizations' },
  { path: '/events', label: 'Events Calendar' },
  { path: '/useful-links', label: 'Useful Links' },
  { path: '/first-time', label: 'First Time Visiting' },
  { path: '/giving', label: 'Giving' },
  { path: '/contact', label: 'Contact Us' },
  { path: '/privacy-policy', label: 'Privacy Policy' },
  { path: '/terms-of-use', label: 'Terms of Use' },
  { path: '/announcements', label: 'Announcements' },
]

test.describe('Public pages @smoke', () => {
  for (const { path, label } of PUBLIC_PAGES) {
    test(`${label} (${path}) loads successfully`, async ({ page }) => {
      const consoleErrors: string[] = []
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          // Ignore known benign errors
          const text = msg.text()
          if (text.includes('Turnstile') || text.includes('cf-turnstile')) return
          if (text.includes('NEXT_PUBLIC_')) return
          consoleErrors.push(text)
        }
      })

      const response = await page.goto(path, { waitUntil: 'domcontentloaded' })

      // Page returns 200
      expect(response?.status()).toBe(200)

      // Nav and footer render (layout is intact)
      await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible()
      await expect(page.locator('footer')).toBeVisible()

      // No console errors
      expect(consoleErrors).toEqual([])
    })
  }
})
