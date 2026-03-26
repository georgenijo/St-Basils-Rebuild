import { test, expect } from '@playwright/test'

/**
 * Smoke: Calendar and announcements render.
 *
 * Calendar: the filter buttons and FullCalendar container render.
 * Announcements: the listing page loads and either shows items or
 * an empty state.
 */

test.describe('Events calendar @smoke', () => {
  test('renders category filter buttons', async ({ page }) => {
    await page.goto('/events', { waitUntil: 'domcontentloaded' })

    const filterGroup = page.locator('[role="group"][aria-label="Filter events by category"]')
    await expect(filterGroup).toBeVisible()

    // All four filter buttons present
    await expect(filterGroup.getByRole('button', { name: 'All Events' })).toBeVisible()
    await expect(filterGroup.getByRole('button', { name: 'Liturgical' })).toBeVisible()
    await expect(filterGroup.getByRole('button', { name: 'Community' })).toBeVisible()
    await expect(filterGroup.getByRole('button', { name: 'Special' })).toBeVisible()

    // "All Events" is active by default
    await expect(filterGroup.getByRole('button', { name: 'All Events' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  test('renders FullCalendar container', async ({ page }) => {
    await page.goto('/events', { waitUntil: 'networkidle' })

    // FullCalendar renders inside the rounded container
    // The dynamically imported CalendarView creates the fc container
    const calendarContainer = page.locator('.fc')
    await expect(calendarContainer).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('Announcements @smoke', () => {
  test('listing page loads', async ({ page }) => {
    const response = await page.goto('/announcements', { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(200)

    // Page should have a heading
    await expect(page.locator('h1, h2').first()).toBeVisible()
  })
})
