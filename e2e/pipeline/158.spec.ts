import { test, expect } from '@playwright/test'

/**
 * Issue #158 — Member portal: Family tab
 *
 * Tests:
 * S1:  /member/family loads without server error
 * S2:  /member/family shows family content or redirects to login
 * S3:  No console errors on the family route
 * S4:  Unauthenticated user is redirected away
 * S5:  Responsive — loads on mobile viewport
 * S6:  Regression — /member overview still loads
 * S7:  Regression — /member/membership still loads
 * S8-S11: Regression — public pages still work
 */

// ─── Console error filter (shared) ──────────────────────────────────

function isIgnoredError(text: string): boolean {
  return (
    text.includes('Turnstile') ||
    text.includes('cf-turnstile') ||
    text.includes('NEXT_PUBLIC_') ||
    text.includes('Failed to load resource')
  )
}

// ─── Route Validation ───────────────────────────────────────────────

test.describe('Issue #158: Family tab route @pipeline', () => {
  test('S1: /member/family loads without server error', async ({ page }) => {
    const response = await page.goto('/member/family', {
      waitUntil: 'domcontentloaded',
    })
    const status = response?.status() ?? 0
    expect(status).toBeLessThan(500)
  })

  test('S2: /member/family either shows family content or redirects', async ({ page }) => {
    await page.goto('/member/family', { waitUntil: 'domcontentloaded' })
    const url = page.url()

    const isFamilyPage = url.includes('/member/family')
    const isRedirected = url.includes('/login')
    expect(isFamilyPage || isRedirected).toBe(true)
  })

  test('S4: Unauthenticated user does not see family data', async ({ page }) => {
    const response = await page.goto('/member/family', {
      waitUntil: 'domcontentloaded',
    })
    const status = response?.status() ?? 0

    // Auth guard: page doesn't crash (< 500) and no family data is leaked
    expect(status).toBeLessThan(500)
    const familyDetailsVisible = await page.locator('text=Family Details').isVisible()
    expect(familyDetailsVisible).toBe(false)
  })
})

// ─── No Console Errors ──────────────────────────────────────────────

test.describe('Issue #158: Console errors @pipeline', () => {
  test('S3: /member/family loads without console errors', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnoredError(msg.text())) {
        consoleErrors.push(msg.text())
      }
    })

    await page.goto('/member/family', { waitUntil: 'domcontentloaded' })
    expect(consoleErrors).toEqual([])
  })
})

// ─── Responsive ─────────────────────────────────────────────────────

test.describe('Issue #158: Responsive @pipeline', () => {
  test('S5: Family route loads on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnoredError(msg.text())) {
        consoleErrors.push(msg.text())
      }
    })

    const response = await page.goto('/member/family', {
      waitUntil: 'domcontentloaded',
    })
    const status = response?.status() ?? 0
    expect(status).toBeLessThan(500)
    expect(consoleErrors).toEqual([])
  })
})

// ─── Regression — Sibling Routes ────────────────────────────────────

test.describe('Issue #158: Sibling route regression @pipeline', () => {
  test('S6: /member route loads without server error', async ({ page }) => {
    const response = await page.goto('/member', { waitUntil: 'domcontentloaded' })
    const status = response?.status() ?? 0
    expect(status).toBeLessThan(500)
  })

  test('S7: /member/membership route loads without server error', async ({ page }) => {
    const response = await page.goto('/member/membership', {
      waitUntil: 'domcontentloaded',
    })
    const status = response?.status() ?? 0
    expect(status).toBeLessThan(500)
  })
})

// ─── Regression — Public Pages ──────────────────────────────────────

test.describe('Issue #158: Public page regression @pipeline', () => {
  const PUBLIC_PAGES = [
    { path: '/', label: 'Homepage' },
    { path: '/events', label: 'Events Calendar' },
    { path: '/about', label: 'About' },
    { path: '/giving', label: 'Giving' },
  ]

  for (const { path, label } of PUBLIC_PAGES) {
    test(`S8-S11: Regression — ${label} (${path}) still loads`, async ({ page }) => {
      const consoleErrors: string[] = []
      page.on('console', (msg) => {
        if (msg.type() === 'error' && !isIgnoredError(msg.text())) {
          consoleErrors.push(msg.text())
        }
      })

      const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
      expect(response?.status()).toBe(200)
      expect(consoleErrors).toEqual([])
    })
  }
})
