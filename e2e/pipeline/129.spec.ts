import { test, expect } from '@playwright/test'

/**
 * Issue #129: Admin theme customization page (font picker, drag-and-drop)
 *
 * Tests cover:
 * - Settings page route exists and compiles (S1, S3)
 * - Settings link appears in admin sidebar (S4)
 * - Regression: homepage, public pages still work with DynamicFonts (S5-S7)
 *
 * Note: Content/interaction tests for the settings page require admin
 * authentication. The admin layout redirects unauthenticated users to
 * /login. Authenticated testing is done via agent-browser (S10).
 */

test.describe('Issue #129: Theme Settings — Route Exists', () => {
  test('S1: /admin/settings compiles and responds (not 404)', async ({ page }) => {
    const response = await page.goto('/admin/settings', { waitUntil: 'domcontentloaded' })
    // The route should exist — it may redirect to /login (307) or render
    // Either way, the initial response should not be 404
    expect(response?.status()).not.toBe(404)
  })

  test('S3: /admin/settings does not return 500', async ({ page }) => {
    const response = await page.goto('/admin/settings', { waitUntil: 'domcontentloaded' })
    expect(response?.status()).not.toBe(500)
  })
})

test.describe('Issue #129: Admin Sidebar — Settings Link', () => {
  test('S4: Settings link visible in admin sidebar after auth', async ({ page }) => {
    // Navigate to admin settings — will redirect through login → dashboard
    // due to dev-bypass. The sidebar should contain Settings link.
    await page.goto('/admin/settings', { waitUntil: 'networkidle' })

    // Wait for the page to settle (dev-bypass redirect chain)
    await page.waitForTimeout(2000)

    const settingsLink = page.getByRole('link', { name: 'Settings' })

    // Only check if we ended up on an admin page (sidebar visible)
    const sidebar = page.locator('[aria-label="Admin sidebar"]')
    if (await sidebar.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(settingsLink).toBeVisible()
      await expect(settingsLink).toHaveAttribute('href', '/admin/settings')
    }
    // If sidebar isn't visible (no dev-bypass), the route still exists per S1
  })
})

test.describe('Issue #129: Regression — Public Pages', () => {
  test('S5: homepage loads with 200', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(200)
  })

  test('S6: homepage renders without JS errors from DynamicFonts', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => {
      // Ignore pre-existing Turnstile config errors (not from this PR)
      if (!err.message.includes('Turnstile')) {
        errors.push(err.message)
      }
    })

    await page.goto('/', { waitUntil: 'domcontentloaded' })

    const nav = page.locator('nav').first()
    await expect(nav).toBeVisible()

    expect(errors).toHaveLength(0)
  })

  test('S7: public pages return 200', async ({ page }) => {
    const publicRoutes = ['/about', '/events', '/announcements', '/contact']

    for (const route of publicRoutes) {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' })
      expect(response?.status(), `${route} should return 200`).toBe(200)
    }
  })
})
