import { test, expect } from '@playwright/test'

/**
 * Issue #151: Server actions: family management
 *
 * This issue adds server actions only (no UI). Tests verify:
 * 1. /member auth guard still works (regression)
 * 2. Public pages still load without errors (regression)
 * 3. Login page still renders correctly (regression)
 */

// ── S5: /member auth guard regression ──────────────────────────────
test.describe('Issue #151: Family actions — regression @pipeline', () => {
  test('S5: /member route loads without server error', async ({ page }) => {
    const response = await page.goto('/member', { waitUntil: 'domcontentloaded' })
    const status = response?.status() ?? 0
    // Should be 200 (authenticated) or redirect to login — never 500
    expect(status).toBeLessThan(500)
  })

  // ── S6: Public pages regression ────────────────────────────────────
  const REGRESSION_PAGES = [
    { path: '/', label: 'Homepage' },
    { path: '/events', label: 'Events Calendar' },
    { path: '/contact', label: 'Contact Us' },
    { path: '/about', label: 'About' },
    { path: '/giving', label: 'Giving' },
  ]

  for (const { path, label } of REGRESSION_PAGES) {
    test(`S6: Regression — ${label} (${path}) loads`, async ({ page }) => {
      const consoleErrors: string[] = []
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text()
          if (text.includes('Turnstile') || text.includes('cf-turnstile')) return
          if (text.includes('NEXT_PUBLIC_')) return
          consoleErrors.push(text)
        }
      })

      const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
      expect(response?.status()).toBe(200)
      expect(consoleErrors).toEqual([])
    })
  }

  // ── Login page renders (regression for member portal) ──────────────
  test('S6: Login route loads without server error', async ({ page }) => {
    const response = await page.goto('/login', { waitUntil: 'domcontentloaded' })
    const status = response?.status() ?? 0
    // Should be 200 (renders form) or redirect (already authenticated) — never 500
    expect(status).toBeLessThan(500)
  })
})
