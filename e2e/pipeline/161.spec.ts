import { test, expect } from '@playwright/test'

/**
 * Issue #161: Admin — assign event costs to families
 *
 * Tests the new charges page route, event detail page button,
 * form rendering, and regression on existing pages.
 *
 * Note: Full form submission (happy path) requires a seeded event,
 * families in the DB, and admin auth. Tests that depend on DB state
 * gracefully handle missing data. Admin pages may redirect to /login
 * if DEV_ADMIN_BYPASS is not active.
 */

test.describe('Issue #161: Event Charges Feature', () => {
  // ── S1: Charges page route exists ─────────────────────────────────
  test('S1: charges page route compiles and responds (not 500)', async ({ page }) => {
    // Use a placeholder UUID — page will 404 if event doesn't exist, which is fine
    const response = await page.goto('/admin/events/00000000-0000-0000-0000-000000000001/charges', {
      waitUntil: 'domcontentloaded',
    })
    const status = response?.status() ?? 0
    // Should be 200 (event exists + authed), 404 (event not found), or 307 redirect to login
    // Never 500 (compilation error)
    expect([200, 307, 404]).toContain(status)
  })

  // ── S2: Charges page returns 404 for non-existent event ───────────
  test('S2: charges page returns 404 for non-existent event UUID', async ({ page }) => {
    const response = await page.goto('/admin/events/00000000-0000-0000-0000-000000000000/charges', {
      waitUntil: 'domcontentloaded',
    })
    const status = response?.status() ?? 0
    // If authenticated (dev bypass): 404. If not: 307 redirect to login.
    // Never 500.
    expect([307, 404]).toContain(status)
  })

  // ── S3: Event detail page has Manage Charges button ───────────────
  test('S3: event detail page renders Manage Charges button', async ({ page }) => {
    // Navigate to admin events list first to find a real event
    const response = await page.goto('/admin/events', {
      waitUntil: 'domcontentloaded',
    })
    const status = response?.status() ?? 0

    // If redirected to login, skip this test gracefully
    if (page.url().includes('/login') || status >= 400) {
      test.skip(true, 'Not authenticated — skipping admin UI test')
    }

    // Find first event link and navigate to its detail page
    const eventLink = page.locator('a[href*="/admin/events/"]').first()
    const hasEvents = await eventLink.isVisible().catch(() => false)

    if (!hasEvents) {
      test.skip(true, 'No events in database — skipping')
    }

    await eventLink.click()
    await page.waitForLoadState('domcontentloaded')

    // Verify both buttons exist
    const manageChargesBtn = page.getByRole('link', { name: 'Manage Charges' })
    const editEventBtn = page.getByRole('link', { name: 'Edit Event' })

    await expect(manageChargesBtn).toBeVisible()
    await expect(editEventBtn).toBeVisible()
  })

  // ── S4: Charges form renders with required elements ───────────────
  test('S4: charges form renders total cost input and family selector', async ({ page }) => {
    // Go to admin events to find a real event
    const listResponse = await page.goto('/admin/events', {
      waitUntil: 'domcontentloaded',
    })

    if (page.url().includes('/login') || (listResponse?.status() ?? 0) >= 400) {
      test.skip(true, 'Not authenticated — skipping admin UI test')
    }

    // Find first event link
    const eventLink = page.locator('a[href*="/admin/events/"]').first()
    const hasEvents = await eventLink.isVisible().catch(() => false)

    if (!hasEvents) {
      test.skip(true, 'No events in database — skipping')
    }

    // Navigate to charges page via the event detail page
    await eventLink.click()
    await page.waitForLoadState('domcontentloaded')

    const manageChargesLink = page.getByRole('link', { name: 'Manage Charges' })
    await manageChargesLink.click()
    await page.waitForLoadState('domcontentloaded')

    // Verify form elements
    const totalCostInput = page.locator('input#total-cost')
    await expect(totalCostInput).toBeVisible()
    await expect(totalCostInput).toHaveAttribute('type', 'number')
    await expect(totalCostInput).toHaveAttribute('step', '0.01')

    // Search input
    const searchInput = page.locator('input[placeholder="Search families..."]')
    await expect(searchInput).toBeVisible()

    // Submit button should be disabled initially (no families selected, no total)
    const submitBtn = page.getByRole('button', { name: /Assign to/ })
    await expect(submitBtn).toBeDisabled()

    // Back to Event link
    const backLink = page.getByRole('link', { name: /Back to Event/ })
    await expect(backLink).toBeVisible()

    // Page heading
    await expect(page.getByRole('heading', { name: 'Manage Charges' })).toBeVisible()
  })

  // ── S10: Submit button reflects selection count ─────────────────────
  test('S10: submit button text reflects family selection count', async ({ page }) => {
    const listResponse = await page.goto('/admin/events', {
      waitUntil: 'domcontentloaded',
    })

    if (page.url().includes('/login') || (listResponse?.status() ?? 0) >= 400) {
      test.skip(true, 'Not authenticated — skipping admin UI test')
    }

    const eventLink = page.locator('a[href*="/admin/events/"]').first()
    const hasEvents = await eventLink.isVisible().catch(() => false)
    if (!hasEvents) test.skip(true, 'No events — skipping')

    await eventLink.click()
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('link', { name: 'Manage Charges' }).click()
    await page.waitForLoadState('domcontentloaded')

    // Initially shows "Assign to 0 Families"
    const submitBtn = page.getByRole('button', { name: /Assign to \d+ Famil/ })
    await expect(submitBtn).toBeVisible()
    await expect(submitBtn).toHaveText(/Assign to 0 Families/)

    // Click first family in the list
    const firstFamily = page.locator('[role="option"]').first()
    const hasFamilies = await firstFamily.isVisible().catch(() => false)
    if (!hasFamilies) test.skip(true, 'No families — skipping')

    await firstFamily.click()

    // Should now say "Assign to 1 Family"
    await expect(submitBtn).toHaveText(/Assign to 1 Family$/)
  })

  // ── S14: No JS console errors on charges page ─────────────────────
  test('S14: charges page loads without JS console errors', async ({ page }) => {
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

    // Navigate to a charges page; fake UUID will 404 which is fine for this test
    const response = await page.goto('/admin/events/00000000-0000-0000-0000-000000000001/charges', {
      waitUntil: 'domcontentloaded',
    })

    // Page should not have server errors or JS errors
    const status = response?.status() ?? 0
    expect([200, 307, 404]).toContain(status)
    expect(consoleErrors).toEqual([])
  })

  // ── S11: Regression — public pages still load ──────────────────────
  const REGRESSION_PAGES = [
    { path: '/', label: 'Homepage' },
    { path: '/about', label: 'About' },
    { path: '/events', label: 'Events Calendar' },
    { path: '/contact', label: 'Contact Us' },
  ]

  for (const { path, label } of REGRESSION_PAGES) {
    test(`S11: Regression — ${label} (${path}) loads`, async ({ page }) => {
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

      const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
      expect(response?.status()).toBe(200)
      expect(consoleErrors).toEqual([])
    })
  }

  // ── S12: Regression — admin routes compile ─────────────────────────
  test('S12: /admin route responds (not 404 or 500)', async ({ page }) => {
    const response = await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    const status = response?.status() ?? 0
    // Admin may redirect to login (307→200) or render directly (200)
    // Should never be 404 or 500
    expect(status).not.toBe(404)
    expect(status).toBeLessThan(500)
  })

  test('S12: /admin/events route responds (not 500)', async ({ page }) => {
    const response = await page.goto('/admin/events', { waitUntil: 'domcontentloaded' })
    const status = response?.status() ?? 0
    expect(status).toBeLessThan(500)
  })
})
