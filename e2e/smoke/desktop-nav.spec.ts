import { type Page, test, expect } from '@playwright/test'

/**
 * Smoke: Desktop navigation breakpoint (#314).
 *
 * Verifies the desktop nav is visible from 1024 px, hidden below it, and
 * free from overflow / wrapping.  Every test guards against an unhealthy
 * dev server by asserting CSS is applied (nav position: fixed) and React
 * has hydrated (hamburger button is in the DOM) before making assertions.
 */

// ─── Helper: navigate and assert the server is healthy ───────────────

async function gotoAndVerifyHealth(page: Page, width: number) {
  await page.goto('/', { waitUntil: 'load' })

  // CSS must be applied: the nav must be position:fixed (not static).
  // If the dev server served a stale/missing CSS file, the nav stays static.
  const navPos = await page.evaluate(() => {
    const nav = document.querySelector('nav')
    return nav ? window.getComputedStyle(nav).position : null
  })
  expect(
    navPos,
    `Server health check failed at ${width}px: nav.position="${navPos}" (expected "fixed"). ` +
      `CSS may not be loading (check dev server).`
  ).toBe('fixed')

  // React hydration: hamburger button is injected by useState after hydration.
  // It is always in the DOM after hydration (just CSS-hidden at >=1024 px).
  await page.waitForFunction(
    () => document.querySelector('button[aria-controls="mobile-menu"]') !== null,
    { timeout: 5000 }
  )
}

// ─── Test viewports ───────────────────────────────────────────────────

const ALL_VIEWPORTS = [
  { label: '1023', width: 1023, height: 768, desktop: false },
  { label: '1024', width: 1024, height: 768, desktop: true },
  { label: '1280', width: 1280, height: 800, desktop: true },
  { label: '1440', width: 1440, height: 900, desktop: true },
]

const DESKTOP_VIEWPORTS = ALL_VIEWPORTS.filter((v) => v.desktop)

// ─── Tests ───────────────────────────────────────────────────────────

test.describe('Desktop navigation breakpoint @smoke', () => {
  // ── Breakpoint boundary ─────────────────────────────────────────────

  test('at 1023 px desktop nav is hidden and hamburger is visible', async ({ page }) => {
    await page.setViewportSize({ width: 1023, height: 768 })
    await gotoAndVerifyHealth(page, 1023)

    const desktopNav = page.locator('nav ul').first()
    await expect(desktopNav).toBeHidden()

    const hamburger = page.locator('button[aria-controls="mobile-menu"]')
    await expect(hamburger).toBeVisible()
  })

  for (const vp of DESKTOP_VIEWPORTS) {
    test(`at ${vp.label} px desktop nav is visible and hamburger is hidden`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await gotoAndVerifyHealth(page, vp.width)

      const desktopNav = page.locator('nav ul').first()
      await expect(desktopNav).toBeVisible()

      for (const label of ['Home', 'About', 'Resources', 'Giving', 'Contact Us']) {
        await expect(desktopNav.getByText(label, { exact: true }).first()).toBeVisible()
      }

      const hamburger = page.locator('button[aria-controls="mobile-menu"]')
      await expect(hamburger).toBeHidden()
    })
  }

  // ── Nav-bar overflow and wrapping ───────────────────────────────────

  for (const vp of DESKTOP_VIEWPORTS) {
    test(`at ${vp.label} px desktop nav items do not overflow or wrap`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await gotoAndVerifyHealth(page, vp.width)

      const desktopNav = page.locator('nav ul').first()

      // No horizontal scroll on the nav list
      const { scrollWidth, clientWidth } = await desktopNav.evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }))
      expect(
        scrollWidth,
        `nav ul scrollWidth ${scrollWidth} > clientWidth ${clientWidth}`
      ).toBeLessThanOrEqual(clientWidth + 1)

      // Wrapping check: ul height must not exceed the tallest top-level item's
      // height by more than 50 %.  items-center shifts shorter items down, so
      // we compare heights rather than tops.
      const { ulHeight, maxItemHeight } = await desktopNav.evaluate((ul) => {
        const lis = Array.from(ul.querySelectorAll(':scope > li'))
        const maxItemHeight = Math.max(...lis.map((li) => li.getBoundingClientRect().height))
        return { ulHeight: ul.getBoundingClientRect().height, maxItemHeight }
      })
      expect(
        ulHeight,
        `nav ul wraps: height ${ulHeight} > 1.5 × max item ${maxItemHeight}`
      ).toBeLessThanOrEqual(maxItemHeight * 1.5)
    })
  }

  // ── Document-level no horizontal overflow ───────────────────────────
  // Required at all target widths including 1023 px.

  for (const vp of ALL_VIEWPORTS) {
    test(`at ${vp.label} px document has no horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await gotoAndVerifyHealth(page, vp.width)

      const { docScrollWidth, viewportWidth } = await page.evaluate(() => ({
        docScrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }))
      expect(
        docScrollWidth,
        `Document scrollWidth ${docScrollWidth} exceeds viewport ${viewportWidth}px — horizontal overflow`
      ).toBeLessThanOrEqual(viewportWidth + 1)
    })
  }

  // ── No logo / nav / login overlaps on desktop ───────────────────────

  test('at 1024 px logo, nav, and login link do not overlap', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await gotoAndVerifyHealth(page, 1024)

    const rects = await page.evaluate(() => {
      const logo = document.querySelector('nav a[aria-label]') as HTMLElement | null
      const navUl = document.querySelector('nav ul') as HTMLElement | null
      const login = document.querySelector('nav a[href="/login"]') as HTMLElement | null
      const r = (el: HTMLElement | null) => (el ? el.getBoundingClientRect() : null)
      return {
        logo: r(logo) ? { left: r(logo)!.left, right: r(logo)!.right } : null,
        nav: r(navUl) ? { left: r(navUl)!.left, right: r(navUl)!.right } : null,
        login: r(login) ? { left: r(login)!.left, right: r(login)!.right } : null,
      }
    })

    expect(rects.logo, 'Logo element not found').not.toBeNull()
    expect(rects.nav, 'Desktop nav list not found').not.toBeNull()
    expect(rects.login, 'Login link not found').not.toBeNull()

    // Logo ends before nav starts (2 px tolerance for sub-pixel rounding)
    expect(
      rects.logo!.right,
      `Logo right ${rects.logo!.right} overlaps nav left ${rects.nav!.left}`
    ).toBeLessThanOrEqual(rects.nav!.left + 2)
    // Nav ends before login starts
    expect(
      rects.nav!.right,
      `Nav right ${rects.nav!.right} overlaps login left ${rects.login!.left}`
    ).toBeLessThanOrEqual(rects.login!.left + 2)
  })

  // ── Mobile nav still works at the breakpoint boundary ───────────────

  test('at 1023 px mobile menu opens and shows all items', async ({ page }) => {
    await page.setViewportSize({ width: 1023, height: 768 })
    await gotoAndVerifyHealth(page, 1023)

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
    await gotoAndVerifyHealth(page, 1023)

    const hamburger = page.locator('button[aria-controls="mobile-menu"]')
    await hamburger.click()
    await expect(hamburger).toHaveAttribute('aria-expanded', 'true')

    await page.keyboard.press('Escape')
    await expect(hamburger).toHaveAttribute('aria-expanded', 'false')
  })
})
