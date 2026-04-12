import { test, expect } from '@playwright/test'

/**
 * Issue #157 — Member portal: Membership tab
 *
 * Tests:
 * S1:  Auth guard — /member/membership either renders (if authed) or redirects to login
 * S2:  Route exists and returns valid response (not 500)
 * S9:  Responsive — page loads on mobile viewport without errors
 * S10: No console errors on the membership route
 * S11: Regression — public pages still work
 */

// ─── Route Validation ───────────────────────────────────────────────

test.describe('Issue #157: Membership tab route @pipeline', () => {
  test('S1: /member/membership loads without server error', async ({ page }) => {
    const response = await page.goto('/member/membership', {
      waitUntil: 'domcontentloaded',
    })
    const status = response?.status() ?? 0
    // Should be 200 (authed) or 200 after redirect to login — never 500
    expect(status).toBeLessThan(500)
  })

  test('S2: /member/membership either shows membership content or redirects', async ({ page }) => {
    await page.goto('/member/membership', { waitUntil: 'domcontentloaded' })
    const url = page.url()

    // Either we're on the membership page (authed) or redirected to login/admin
    const isMembershipPage = url.includes('/member/membership')
    const isRedirected = url.includes('/login') || url.includes('/admin')
    expect(isMembershipPage || isRedirected).toBe(true)
  })
})

// ─── Regression ─────────────────────────────────────────────────────

test.describe('Issue #157: Regression @pipeline', () => {
  test('S11a: /member route loads without server error', async ({ page }) => {
    const response = await page.goto('/member', { waitUntil: 'domcontentloaded' })
    const status = response?.status() ?? 0
    // Should load or redirect — never 500
    expect(status).toBeLessThan(500)
  })

  const PUBLIC_PAGES = [
    { path: '/', label: 'Homepage' },
    { path: '/events', label: 'Events Calendar' },
    { path: '/about', label: 'About' },
    { path: '/giving', label: 'Giving' },
  ]

  for (const { path, label } of PUBLIC_PAGES) {
    test(`S11c: Regression — ${label} (${path}) still loads`, async ({ page }) => {
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
})

// ─── No Console Errors ──────────────────────────────────────────────

test.describe('Issue #157: Console errors @pipeline', () => {
  test('S10: /member/membership loads without console errors', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        if (text.includes('Turnstile') || text.includes('cf-turnstile')) return
        if (text.includes('NEXT_PUBLIC_')) return
        if (text.includes('Failed to load resource')) return
        consoleErrors.push(text)
      }
    })

    await page.goto('/member/membership', { waitUntil: 'domcontentloaded' })
    expect(consoleErrors).toEqual([])
  })
})

// ─── Responsive ─────────────────────────────────────────────────────

test.describe('Issue #157: Responsive @pipeline', () => {
  test('S9: Membership route loads on mobile viewport', async ({ page }) => {
    page.setViewportSize({ width: 375, height: 667 })
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        if (text.includes('Turnstile') || text.includes('cf-turnstile')) return
        if (text.includes('NEXT_PUBLIC_')) return
        if (text.includes('Failed to load resource')) return
        consoleErrors.push(text)
      }
    })

    const response = await page.goto('/member/membership', {
      waitUntil: 'domcontentloaded',
    })
    const status = response?.status() ?? 0
    expect(status).toBeLessThan(500)
    expect(consoleErrors).toEqual([])
  })
})
