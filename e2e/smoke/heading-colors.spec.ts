import { test, expect, type Page } from '@playwright/test'

/**
 * Smoke: heading colours (#312).
 *
 * The h1–h6 defaults in globals.css must sit in `@layer base` so a heading's
 * own colour utility (e.g. text-cream-50 on a hero or dark section) wins.
 * When the rule was unlayered, every heading resolved to wood-900, which made
 * hero, PageHero, footer and dark-section headings dark-on-dark.
 */

/** Resolve a theme colour token to the computed rgb() string the browser uses. */
async function tokenColor(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement('span')
    probe.style.color = `var(${name})`
    document.body.appendChild(probe)
    const color = getComputedStyle(probe).color
    probe.remove()
    return color
  }, token)
}

test.describe('Heading colours @smoke', () => {
  test('homepage hero h1 renders in the cream token', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const cream = await tokenColor(page, '--color-cream-50')

    const heroTitle = page.getByRole('heading', { level: 1, name: 'Come As You Are' })
    await expect(heroTitle).toHaveCSS('color', cream)
  })

  test('PageHero title and dark-section headings render in the cream token', async ({ page }) => {
    await page.goto('/contact', { waitUntil: 'domcontentloaded' })
    const cream = await tokenColor(page, '--color-cream-50')

    // PageHero title over the dark image overlay.
    await expect(page.locator('main h1').first()).toHaveCSS('color', cream)
    // SectionHeader on bg-charcoal, coloured via [&_h2]:text-cream-50.
    await expect(
      page.locator('main').getByRole('heading', { level: 2, name: 'Sunday Services' })
    ).toHaveCSS('color', cream)
    // Footer headings on the charcoal footer.
    await expect(
      page.locator('footer').getByRole('heading', { level: 2, name: 'Quick Links' })
    ).toHaveCSS('color', cream)
  })

  test('ordinary headings keep the wood-900 heading colour and font', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const wood900 = await tokenColor(page, '--color-wood-900')

    // A body heading on a light section keeps its original colour.
    await expect(page.getByRole('heading', { level: 2, name: "Welcome to St. Basil's" })).toHaveCSS(
      'color',
      wood900
    )

    // A bare heading with no utilities still gets the base-layer defaults.
    const bare = await page.evaluate(() => {
      const h = document.createElement('h2')
      h.textContent = 'Probe'
      document.querySelector('main')!.appendChild(h)
      const style = getComputedStyle(h)
      const result = { color: style.color, fontFamily: style.fontFamily }
      h.remove()
      return result
    })
    expect(bare.color).toBe(wood900)
    const headingFont = await page.evaluate(() => {
      const probe = document.createElement('span')
      probe.style.fontFamily = 'var(--font-heading)'
      document.body.appendChild(probe)
      const font = getComputedStyle(probe).fontFamily
      probe.remove()
      return font
    })
    expect(bare.fontFamily).toBe(headingFont)
  })
})
