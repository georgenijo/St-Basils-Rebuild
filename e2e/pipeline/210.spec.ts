import { expect, test } from '@playwright/test'

/**
 * Issue #210 — subscriber/user consolidation.
 *
 * Minimal unauthenticated specs. Full flows (invite → opt-in upsert, admin
 * cross-link badges) require seeded fixtures and are deferred to the ship
 * stage or to a seeded E2E run with admin session fixtures.
 */

test.describe('issue #210 — admin pages redirect unauthenticated visitors', () => {
  test('/admin/subscribers redirects to login when unauthenticated', async ({ page }) => {
    const response = await page.goto('/admin/subscribers')
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    expect(page.url()).toMatch(/\/login/)
    expect(response?.status() ?? 0).toBeLessThan(500)
  })

  test('/admin/users redirects to login when unauthenticated', async ({ page }) => {
    const response = await page.goto('/admin/users')
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    expect(page.url()).toMatch(/\/login/)
    expect(response?.status() ?? 0).toBeLessThan(500)
  })
})
