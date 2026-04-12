import { test, expect } from '@playwright/test'

/**
 * Issue #154 — Server actions: admin event charges and payment recording
 *
 * These are backend server actions with no UI yet (admin UI is #161/#162).
 * Tests verify:
 * 1. App compiles and serves without errors from new code
 * 2. Regression: public pages still work
 * 3. Admin route exists (not 404)
 */

// ─── Regression Tests ──────────────────────────────────────────────

test.describe('Issue #154: Regression — App compiles @pipeline', () => {
  test('homepage loads with 200', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(200)
  })

  test('homepage renders without JS errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => {
      if (!err.message.includes('Turnstile')) {
        errors.push(err.message)
      }
    })

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const nav = page.locator('nav').first()
    await expect(nav).toBeVisible()

    expect(errors).toHaveLength(0)
  })

  test('public pages return 200', async ({ page }) => {
    const publicRoutes = ['/about', '/events', '/announcements', '/contact']

    for (const route of publicRoutes) {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' })
      expect(response?.status(), `${route} should return 200`).toBe(200)
    }
  })
})

test.describe('Issue #154: Admin route exists @pipeline', () => {
  test('/admin compiles and responds (not 404 or 500)', async ({ page }) => {
    const response = await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    // Admin may redirect to /login — that's fine, just not 404/500
    expect(response?.status()).not.toBe(404)
    expect(response?.status()).not.toBe(500)
  })
})
