import { expect, test, type Page } from '@playwright/test'

const HERO_TITLE = 'Come As You Are'
const PSALM_REFERENCE = 'Psalms 34:8'
const VIEWPORTS = [
  { label: 'mobile', width: 390, height: 844 },
  { label: 'desktop', width: 1440, height: 900 },
] as const

function heroLocators(page: Page) {
  const heading = page.getByRole('heading', { level: 1, name: HERO_TITLE })
  const wrapper = page.locator('div.animate-fade-in-delay').filter({ has: heading })
  const quote = page.locator('p').filter({ hasText: PSALM_REFERENCE })

  return { heading, wrapper, quote }
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true)
}

async function expectHeroVisibleWithoutMotion(page: Page) {
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(
    true
  )
  const { heading, wrapper, quote } = heroLocators(page)
  const dropInHeading = wrapper.getByRole('heading', {
    level: 2,
    name: "St. Basil's Syriac Orthodox Church",
  })

  await expect(heading).toHaveText(HERO_TITLE)
  await expect(heading).toBeInViewport()
  await expect(wrapper).toBeInViewport()
  await expect(dropInHeading).toBeInViewport()
  await expect(quote).toContainText(PSALM_REFERENCE)
  await expect(quote).toBeInViewport()

  // Check the animated elements themselves, not just the headings inside them.
  await expect(wrapper).toHaveCSS('opacity', '1')
  await expect(wrapper).toHaveCSS('animation-name', 'none')
  await expect(dropInHeading).toHaveCSS('opacity', '1')
  await expect(dropInHeading).toHaveCSS('animation-name', 'none')
  await expect(quote).toHaveCSS('opacity', '1')
  await expect(quote).toHaveCSS('animation-name', 'none')

  const typewriter = await heading.evaluate((element) => {
    const style = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    return {
      animationName: style.animationName,
      borderRightWidth: style.borderRightWidth,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      width: rect.width,
    }
  })
  expect(typewriter.animationName).toBe('none')
  expect(typewriter.borderRightWidth).toBe('0px')
  expect(typewriter.width).toBeGreaterThan(0)
  expect(typewriter.scrollWidth).toBeLessThanOrEqual(typewriter.clientWidth)

  await expectNoHorizontalOverflow(page)
}

test.describe('Homepage hero reduced motion @smoke', () => {
  for (const viewport of VIEWPORTS) {
    test.describe(`${viewport.label} viewport`, () => {
      test.use({
        viewport: { width: viewport.width, height: viewport.height },
        contextOptions: { reducedMotion: 'reduce' },
      })

      test('hero is fully visible with reduced motion', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' })
        await expectHeroVisibleWithoutMotion(page)
      })
    })
  }
})

test.describe('Homepage hero reduced motion without JavaScript @smoke', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    contextOptions: { reducedMotion: 'reduce' },
    javaScriptEnabled: false,
  })

  test('server-rendered hero is visible', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expectHeroVisibleWithoutMotion(page)
  })
})

test.describe('Homepage hero without reduced motion @smoke', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    contextOptions: { reducedMotion: 'no-preference' },
  })

  test('hero eventually appears with its animations', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const { heading, wrapper, quote } = heroLocators(page)

    await expect(heading).toHaveText(HERO_TITLE)
    await expect(heading).toBeInViewport()
    await expect(wrapper).toBeInViewport()
    await expect(quote).toBeInViewport()
    await expect(wrapper).toHaveCSS('opacity', '1')
    await expect(wrapper).toHaveCSS('animation-name', 'fadeInDelay')
    await expect(quote).toHaveCSS('opacity', '1')
    await expect(quote).toHaveCSS('animation-name', 'fadeInDelay')

    const typewriter = await heading.evaluate((element) => {
      const style = getComputedStyle(element)
      return { animationName: style.animationName, borderRightWidth: style.borderRightWidth }
    })
    expect(typewriter.animationName).toContain('typewriter')
    expect(typewriter.borderRightWidth).toBe('3px')

    await expectNoHorizontalOverflow(page)
  })
})
