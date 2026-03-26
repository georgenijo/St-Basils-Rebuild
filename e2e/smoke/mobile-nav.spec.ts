import { test, expect } from '@playwright/test'

/**
 * Smoke: Mobile navigation.
 *
 * Uses the mobile-chrome project (Pixel 5 viewport)
 * to verify hamburger menu opens/closes and all nav links are reachable.
 */

test.describe('Mobile navigation @smoke', () => {
  test.use({ viewport: { width: 393, height: 851 } })

  test('hamburger menu opens and shows all nav items', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    // Desktop nav should be hidden, hamburger visible
    const hamburger = page.locator('button[aria-controls="mobile-menu"]')
    await expect(hamburger).toBeVisible()
    await expect(hamburger).toHaveAttribute('aria-expanded', 'false')

    // Open the menu
    await hamburger.click()
    await expect(hamburger).toHaveAttribute('aria-expanded', 'true')

    const mobileMenu = page.locator('#mobile-menu')

    // Top-level nav items visible
    await expect(mobileMenu.getByText('Home')).toBeVisible()
    await expect(mobileMenu.getByText('About')).toBeVisible()
    await expect(mobileMenu.getByText('Resources')).toBeVisible()
    await expect(mobileMenu.getByText('Giving')).toBeVisible()
    await expect(mobileMenu.getByText('Contact Us')).toBeVisible()
  })

  test('accordion dropdowns expand on tap', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    // Open menu
    await page.locator('button[aria-controls="mobile-menu"]').click()

    // Tap "About" accordion
    const aboutButton = page.locator('#mobile-menu button', { hasText: 'About' })
    await aboutButton.click()
    await expect(aboutButton).toHaveAttribute('aria-expanded', 'true')

    // Sub-items should be visible
    await expect(page.locator('#mobile-menu').getByText('Our History')).toBeVisible()
    await expect(page.locator('#mobile-menu').getByText('Our Clergy')).toBeVisible()
    await expect(page.locator('#mobile-menu').getByText('Our Organizations')).toBeVisible()
  })

  test('menu closes after clicking a link', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    const hamburger = page.locator('button[aria-controls="mobile-menu"]')
    await hamburger.click()

    // Click a direct link
    await page.locator('#mobile-menu').getByText('Giving').click()

    // Should navigate and close menu
    await page.waitForURL('**/giving')
    await expect(hamburger).toHaveAttribute('aria-expanded', 'false')
  })
})
