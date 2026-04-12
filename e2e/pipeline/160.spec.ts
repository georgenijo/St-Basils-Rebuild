import { test, expect } from '@playwright/test'

/**
 * Issue #160 — Member portal: Shares tab
 *
 * Tests:
 * S1:  /member/shares loads without server error
 * S2:  /member/shares either shows shares content or redirects
 * S3:  No console errors on the shares route
 * S4:  Responsive — shares loads on mobile viewport
 * S5:  Regression — /member overview still loads
 * S6:  Regression — /member/membership still loads
 * S7:  Regression — public pages still work
 */

// ─── Route Validation ───────────────────────────────────────────────

test.describe('Issue #160: Shares tab route @pipeline', () => {
  test('S1: /member/shares loads without server error', async ({ page }) => {
    const response = await page.goto('/member/shares', {
      waitUntil: 'domcontentloaded',
    })
    const status = response?.status() ?? 0
    // Should be 200 (authed) or 200 after redirect to login — never 500
    expect(status).toBeLessThan(500)
  })

  test('S2: /member/shares either shows shares content or redirects', async ({ page }) => {
    await page.goto('/member/shares', { waitUntil: 'domcontentloaded' })
    const url = page.url()

    // Either we're on the shares page (authed) or redirected to login/admin
    const isSharesPage = url.includes('/member/shares')
    const isRedirected = url.includes('/login') || url.includes('/admin')
    expect(isSharesPage || isRedirected).toBe(true)
  })
})

// ─── No Console Errors ──────────────────────────────────────────────

test.describe('Issue #160: Console errors @pipeline', () => {
  test('S3: /member/shares loads without console errors', async ({ page }) => {
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

    await page.goto('/member/shares', { waitUntil: 'domcontentloaded' })
    expect(consoleErrors).toEqual([])
  })
})

// ─── Responsive ─────────────────────────────────────────────────────

test.describe('Issue #160: Responsive @pipeline', () => {
  test('S4: Shares route loads on mobile viewport', async ({ page }) => {
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

    const response = await page.goto('/member/shares', {
      waitUntil: 'domcontentloaded',
    })
    const status = response?.status() ?? 0
    expect(status).toBeLessThan(500)
    expect(consoleErrors).toEqual([])
  })
})

// ─── Regression ─────────────────────────────────────────────────────

test.describe('Issue #160: Regression @pipeline', () => {
  test('S5: /member route loads without server error', async ({ page }) => {
    const response = await page.goto('/member', { waitUntil: 'domcontentloaded' })
    const status = response?.status() ?? 0
    expect(status).toBeLessThan(500)
  })

  test('S6: /member/membership route loads without server error', async ({ page }) => {
    const response = await page.goto('/member/membership', { waitUntil: 'domcontentloaded' })
    const status = response?.status() ?? 0
    expect(status).toBeLessThan(500)
  })

  const PUBLIC_PAGES = [
    { path: '/', label: 'Homepage' },
    { path: '/events', label: 'Events Calendar' },
    { path: '/about', label: 'About' },
    { path: '/giving', label: 'Giving' },
  ]

  for (const { path, label } of PUBLIC_PAGES) {
    test(`S7: Regression — ${label} (${path}) still loads`, async ({ page }) => {
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
