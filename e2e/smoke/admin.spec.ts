import { test, expect } from '@playwright/test'

/**
 * Smoke: Admin pages.
 *
 * Without valid credentials we can only verify:
 * - The login page renders correctly
 * - Protected admin routes redirect to login (auth guard works)
 */

test.describe('Admin login @smoke', () => {
  test('login page renders email and password fields', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })

    await expect(page.locator('input#email')).toBeVisible()
    await expect(page.locator('input#password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })
})

test.describe('Admin auth guard @smoke', () => {
  const PROTECTED_ROUTES = [
    '/admin',
    '/admin/dashboard',
    '/admin/events',
    '/admin/announcements',
  ]

  for (const route of PROTECTED_ROUTES) {
    test(`${route} redirects unauthenticated users`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' })
      const url = page.url()

      // Should either redirect to /login or show 401/403
      // Next.js middleware typically redirects to login
      const isRedirected = url.includes('/login')
      const isBlocked = response?.status() === 401 || response?.status() === 403
      const isOk = response?.status() === 200 && url.includes('/login')

      expect(isRedirected || isBlocked || isOk).toBeTruthy()
    })
  }
})
