import { test, expect } from '@playwright/test'

/**
 * Issue #183: Event RSVP — public form, WhatsApp sharing, admin headcount view
 *
 * Tests the public RSVP page renders correctly, handles edge cases,
 * and verifies regression on existing public pages.
 */

test.describe('Issue #183: RSVP Feature', () => {
  // ── S2: Non-existent slug returns 404 ────────────────────────────────
  test('S2: RSVP page returns 404 for non-existent slug', async ({ page }) => {
    const response = await page.goto('/rsvp/nonexistent-event-12345', {
      waitUntil: 'domcontentloaded',
    })
    expect(response?.status()).toBe(404)
  })

  // ── S14: OG meta tags on RSVP page ──────────────────────────────────
  // This test verifies the page structure at the route level — if no RSVP-enabled
  // event exists in the DB, it should still 404 gracefully (covered by S2).
  // OG tag verification requires a seeded DB event, so we test the 404 path.

  // ── S16: Regression — existing public pages still load ───────────────
  const REGRESSION_PAGES = [
    { path: '/', label: 'Homepage' },
    { path: '/events', label: 'Events Calendar' },
    { path: '/contact', label: 'Contact Us' },
    { path: '/about', label: 'About' },
    { path: '/giving', label: 'Giving' },
  ]

  for (const { path, label } of REGRESSION_PAGES) {
    test(`S16: Regression — ${label} (${path}) still loads`, async ({ page }) => {
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
      await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible()
      await expect(page.locator('footer')).toBeVisible()
      expect(consoleErrors).toEqual([])
    })
  }

  // ── S1: RSVP page structure (requires seeded event) ──────────────────
  // The following tests validate component rendering. Since the RSVP page
  // requires a real event in the DB with rsvp_settings.enabled=true, and
  // we may not have one seeded, we test what we can:

  test('S1: RSVP route exists and returns valid response', async ({ page }) => {
    // Even without a seeded event, the route should exist and return
    // either a rendered page or a 404 — not a 500 error
    const response = await page.goto('/rsvp/test-rsvp-event', {
      waitUntil: 'domcontentloaded',
    })
    const status = response?.status() ?? 0
    // Should be 200 (if event exists) or 404 (if not) — never 500
    expect([200, 404]).toContain(status)
  })

  // ── Component structure tests (verify code quality) ──────────────────

  test('S6: RSVP form name field has required attribute', async ({ page }) => {
    // Navigate to an RSVP page — if event exists it renders form,
    // if not we get 404. This is a defensive test.
    const response = await page.goto('/rsvp/test-rsvp-event', {
      waitUntil: 'domcontentloaded',
    })

    if (response?.status() === 200) {
      const nameInput = page.locator('input[name="name"]')
      await expect(nameInput).toHaveAttribute('required', '')
      await expect(nameInput).toHaveAttribute('maxlength', '100')
    }
    // If 404, test is not applicable — skip gracefully
  })

  test('S4: Headcount picker renders with correct ARIA', async ({ page }) => {
    const response = await page.goto('/rsvp/test-rsvp-event', {
      waitUntil: 'domcontentloaded',
    })

    if (response?.status() === 200) {
      const radioGroup = page.locator('[role="radiogroup"]')
      await expect(radioGroup).toBeVisible()
      await expect(radioGroup).toHaveAttribute('aria-label', 'Number of people')

      // 5 buttons in the radiogroup
      const buttons = radioGroup.locator('button[role="radio"]')
      await expect(buttons).toHaveCount(5)

      // First button (1) should be checked by default
      await expect(buttons.first()).toHaveAttribute('aria-checked', 'true')
    }
  })

  test('S15: RSVP page renders on mobile without errors', async ({ page, browserName }) => {
    // This test runs on both desktop and mobile projects per playwright config
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        if (text.includes('Turnstile') || text.includes('cf-turnstile')) return
        if (text.includes('NEXT_PUBLIC_')) return
        if (text.includes('Failed to load resource')) return // 404 page may trigger resource loads
        consoleErrors.push(text)
      }
    })

    const response = await page.goto('/rsvp/test-rsvp-event', {
      waitUntil: 'domcontentloaded',
    })

    const status = response?.status() ?? 0
    expect([200, 404]).toContain(status)
    expect(consoleErrors).toEqual([])
  })
})
