import { type Page, test, expect } from '@playwright/test'

/**
 * Accessibility regression tests for mobile nav (Astra findings NAV-1/2/3).
 *
 * NAV-1: Tab/ShiftTab trapped inside open mobile menu (no escape to page body).
 * NAV-2: Collapsed accordion items are not in the tab order; expanded items are.
 * NAV-3: Resizing to desktop breakpoint closes the mobile menu and clears scroll lock.
 */

// ─── Helper: navigate and assert the server is healthy ────────────────

async function gotoAndVerifyHealth(page: Page, width: number) {
  await page.goto('/', { waitUntil: 'load' })

  const navPos = await page.evaluate(() => {
    const nav = document.querySelector('nav')
    return nav ? window.getComputedStyle(nav).position : null
  })
  expect(
    navPos,
    `Server health check failed at ${width}px: nav.position="${navPos}" (expected "fixed").`
  ).toBe('fixed')

  await page.waitForFunction(
    () => document.querySelector('button[aria-controls="mobile-menu"]') !== null,
    { timeout: 5000 }
  )
}

// ─── NAV-1: Focus trap ────────────────────────────────────────────────

test.describe('NAV-1: Mobile menu focus trap @smoke', () => {
  test('Tab from last mobile-menu item wraps to first (forward trap)', async ({ page }) => {
    await page.setViewportSize({ width: 1023, height: 768 })
    await gotoAndVerifyHealth(page, 1023)

    const hamburger = page.locator('button[aria-controls="mobile-menu"]')
    await hamburger.click()
    await expect(hamburger).toHaveAttribute('aria-expanded', 'true')

    // Focus the last item in the mobile menu (Login link)
    const loginLink = page.locator('#mobile-menu a[href="/login"]')
    await loginLink.focus()
    await expect(loginLink).toBeFocused()

    // Tab from the last item should wrap to the first focusable (Logo link)
    await page.keyboard.press('Tab')

    const logoLink = page.locator('nav a[aria-label]')
    await expect(logoLink).toBeFocused()
  })

  test('ShiftTab from first mobile-menu item wraps to last (backward trap)', async ({ page }) => {
    await page.setViewportSize({ width: 1023, height: 768 })
    await gotoAndVerifyHealth(page, 1023)

    const hamburger = page.locator('button[aria-controls="mobile-menu"]')
    await hamburger.click()
    await expect(hamburger).toHaveAttribute('aria-expanded', 'true')

    // Focus the logo link (first focusable inside the nav)
    const logoLink = page.locator('nav a[aria-label]')
    await logoLink.focus()
    await expect(logoLink).toBeFocused()

    // ShiftTab from the first item should wrap to the last (Login link)
    await page.keyboard.press('Shift+Tab')

    const loginLink = page.locator('#mobile-menu a[href="/login"]')
    await expect(loginLink).toBeFocused()
  })
})

// ─── NAV-2: Accordion tab order ───────────────────────────────────────

test.describe('NAV-2: Accordion collapsed items are not Tab-reachable @smoke', () => {
  test('Tab from accordion trigger skips collapsed children to next trigger', async ({ page }) => {
    await page.setViewportSize({ width: 1023, height: 768 })
    await gotoAndVerifyHealth(page, 1023)

    const hamburger = page.locator('button[aria-controls="mobile-menu"]')
    await hamburger.click()
    await expect(hamburger).toHaveAttribute('aria-expanded', 'true')

    // Both accordions start collapsed. Tab from About button should go to Resources button.
    const aboutButton = page.locator('#mobile-menu button[aria-controls="accordion-About"]')
    await aboutButton.focus()
    await expect(aboutButton).toBeFocused()

    await page.keyboard.press('Tab')

    const resourcesButton = page.locator('#mobile-menu button[aria-controls="accordion-Resources"]')
    await expect(resourcesButton).toBeFocused()
  })

  test('expanded accordion links are Tab-reachable', async ({ page }) => {
    await page.setViewportSize({ width: 1023, height: 768 })
    await gotoAndVerifyHealth(page, 1023)

    const hamburger = page.locator('button[aria-controls="mobile-menu"]')
    await hamburger.click()
    await expect(hamburger).toHaveAttribute('aria-expanded', 'true')

    // Expand the About accordion
    const aboutButton = page.locator('#mobile-menu button[aria-controls="accordion-About"]')
    await aboutButton.click()
    await expect(aboutButton).toHaveAttribute('aria-expanded', 'true')

    // Tab from About button should reach the first expanded child (Our History)
    await aboutButton.focus()
    await page.keyboard.press('Tab')

    const ourHistoryLink = page.locator('#mobile-menu #accordion-About').getByText('Our History', {
      exact: true,
    })
    await expect(ourHistoryLink).toBeFocused()
  })

  test('collapsed accordion panel has aria-hidden and links have tabindex=-1', async ({ page }) => {
    await page.setViewportSize({ width: 1023, height: 768 })
    await gotoAndVerifyHealth(page, 1023)

    const hamburger = page.locator('button[aria-controls="mobile-menu"]')
    await hamburger.click()

    // The About panel is collapsed — its aria-hidden should be "true"
    const aboutPanel = page.locator('#accordion-About')
    await expect(aboutPanel).toHaveAttribute('aria-hidden', 'true')

    // First child link should have tabindex=-1
    const firstChildLink = page.locator('#accordion-About a').first()
    await expect(firstChildLink).toHaveAttribute('tabindex', '-1')
  })

  test('expanded accordion panel removes aria-hidden and tabindex', async ({ page }) => {
    await page.setViewportSize({ width: 1023, height: 768 })
    await gotoAndVerifyHealth(page, 1023)

    const hamburger = page.locator('button[aria-controls="mobile-menu"]')
    await hamburger.click()

    const aboutButton = page.locator('#mobile-menu button[aria-controls="accordion-About"]')
    await aboutButton.click()
    await expect(aboutButton).toHaveAttribute('aria-expanded', 'true')

    const aboutPanel = page.locator('#accordion-About')
    await expect(aboutPanel).toHaveAttribute('aria-hidden', 'false')

    // Links must not have tabindex=-1 when expanded
    const firstChildLink = page.locator('#accordion-About a').first()
    await expect(firstChildLink).not.toHaveAttribute('tabindex', '-1')
  })
})

// ─── NAV-3: Resize resets mobile state ───────────────────────────────

test.describe('NAV-3: Resize to desktop closes mobile menu and releases scroll lock @smoke', () => {
  test('body overflow is cleared when viewport crosses lg breakpoint', async ({ page }) => {
    await page.setViewportSize({ width: 1023, height: 768 })
    await gotoAndVerifyHealth(page, 1023)

    // Open mobile menu — this locks scroll
    const hamburger = page.locator('button[aria-controls="mobile-menu"]')
    await hamburger.click()
    await expect(hamburger).toHaveAttribute('aria-expanded', 'true')

    const overflowBefore = await page.evaluate(() => document.body.style.overflow)
    expect(overflowBefore, 'body.overflow should be "hidden" when menu is open').toBe('hidden')

    // Resize to desktop breakpoint — menu should close and scroll should unlock
    await page.setViewportSize({ width: 1024, height: 768 })

    // Wait for React state update + effect
    await page.waitForFunction(() => document.body.style.overflow === '', { timeout: 3000 })

    const overflowAfter = await page.evaluate(() => document.body.style.overflow)
    expect(overflowAfter, 'body.overflow should be cleared after resize to 1024px').toBe('')
  })

  test('hamburger aria-expanded resets to false after resize to desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1023, height: 768 })
    await gotoAndVerifyHealth(page, 1023)

    const hamburger = page.locator('button[aria-controls="mobile-menu"]')
    await hamburger.click()
    await expect(hamburger).toHaveAttribute('aria-expanded', 'true')

    await page.setViewportSize({ width: 1024, height: 768 })

    // Wait for React to process the resize
    await page.waitForFunction(() => document.body.style.overflow === '', { timeout: 3000 })

    // Attribute must be false even though button is visually hidden at this width
    await expect(hamburger).toHaveAttribute('aria-expanded', 'false')
  })
})
