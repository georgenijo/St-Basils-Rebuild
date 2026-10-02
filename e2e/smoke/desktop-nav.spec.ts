import { test, expect } from '@playwright/test'

/**
 * Smoke: Desktop navigation breakpoint (#314).
 *
 * Verifies that the full desktop nav is visible from 1024 px,
 * hidden below 1024 px, and free from overflow / wrapping at all
 * target widths.
 */

const VIEWPORTS = [
  { label: '1024', width: 1024, height: 768 },
  { label: '1280', width: 1280, height: 800 },
  { label: '1440', width: 1440, height: 900 },
]

test.describe('Desktop navigation breakpoint @smoke', () => {
  // ── Below breakpoint: mobile mode ──────────────────────────────────

  test('at 1023 px desktop nav is hidden and hamburger is visible', async ({ page }) => {
    await page.setViewportSize({ width: 1023, height: 768 })
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    // Desktop nav list hidden
    const desktopNav = page.locator('nav ul').first()
    await expect(desktopNav).toBeHidden()

    // Hamburger button visible
    const hamburger = page.locator('button[aria-controls="mobile-menu"]')
    await expect(hamburger).toBeVisible()
  })

  // ── At and above breakpoint: desktop mode ──────────────────────────

  for (const vp of VIEWPORTS) {
    test(`at ${vp.label} px desktop nav is visible and hamburger is hidden`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/', { waitUntil: 'domcontentloaded' })

      // Desktop nav list visible
      const desktopNav = page.locator('nav ul').first()
      await expect(desktopNav).toBeVisible()

      // All top-level links visible
      for (const label of ['Home', 'About', 'Resources', 'Giving', 'Contact Us']) {
        await expect(desktopNav.getByText(label, { exact: true }).first()).toBeVisible()
      }

      // Hamburger hidden
      const hamburger = page.locator('button[aria-controls="mobile-menu"]')
      await expect(hamburger).toBeHidden()
    })

    test(`at ${vp.label} px desktop nav items do not overflow or wrap`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/', { waitUntil: 'domcontentloaded' })

      const desktopNav = page.locator('nav ul').first()

      // No horizontal scroll on the nav list itself
      const { scrollWidth, clientWidth } = await desktopNav.evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }))
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1) // 1 px rounding tolerance

      // Wrapping check: ul height must not exceed the tallest single top-level
      // item's height (with a 50% tolerance). If items wrapped, ul height
      // would be at least 2× a single row's height.
      // Note: items-center gives different top values for items of different
      // heights, so we compare heights rather than tops.
      const { ulHeight, maxItemHeight } = await desktopNav.evaluate((ul) => {
        const lis = Array.from(ul.querySelectorAll(':scope > li'))
        const maxItemHeight = Math.max(...lis.map((li) => li.getBoundingClientRect().height))
        return { ulHeight: ul.getBoundingClientRect().height, maxItemHeight }
      })
      expect(ulHeight).toBeLessThanOrEqual(maxItemHeight * 1.5)
    })
  }

  // ── Mobile nav still works at boundary ────────────────────────────

  test('at 1023 px mobile menu opens and shows all items', async ({ page }) => {
    await page.setViewportSize({ width: 1023, height: 768 })
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    const hamburger = page.locator('button[aria-controls="mobile-menu"]')
    await hamburger.click()
    await expect(hamburger).toHaveAttribute('aria-expanded', 'true')

    const mobileMenu = page.locator('#mobile-menu')
    for (const label of ['Home', 'About', 'Resources', 'Giving', 'Contact Us']) {
      await expect(mobileMenu.getByText(label, { exact: true }).first()).toBeVisible()
    }
  })

  test('at 1023 px Escape key closes mobile menu', async ({ page }) => {
    await page.setViewportSize({ width: 1023, height: 768 })
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    const hamburger = page.locator('button[aria-controls="mobile-menu"]')
    await hamburger.click()
    await expect(hamburger).toHaveAttribute('aria-expanded', 'true')

    await page.keyboard.press('Escape')
    await expect(hamburger).toHaveAttribute('aria-expanded', 'false')
  })
})
