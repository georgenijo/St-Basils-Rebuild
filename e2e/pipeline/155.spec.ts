import { test, expect } from '@playwright/test'

/**
 * Issue #155 — Member portal layout, routing, and login redirect
 *
 * Tests:
 * 1. Member auth guard — /member redirects unauthenticated users to login
 * 2. Login page renders correctly
 * 3. Login page preserves redirectTo hidden input when provided
 * 4. Invalid credentials show error
 * 5. Responsive — login form usable on mobile
 */

// ─── Auth Guard Tests ───────────────────────────────────────────────

test.describe('Member auth guard @pipeline', () => {
  test('/member redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/member', { waitUntil: 'domcontentloaded' })
    const url = page.url()

    // Should end up on the login page (via layout redirect)
    expect(url).toContain('/login')
  })

  test('/member returns redirect status', async ({ page }) => {
    // Navigate and verify we land on login
    const response = await page.goto('/member', { waitUntil: 'domcontentloaded' })

    // Should get a 200 OK (after following the redirect to login)
    expect(response?.status()).toBe(200)
    // Final URL should be login
    expect(page.url()).toContain('/login')
    // Login form should be visible
    await expect(page.locator('input#email')).toBeVisible()
  })
})

// ─── Login Page Tests ───────────────────────────────────────────────

test.describe('Login page @pipeline', () => {
  test('renders email and password fields', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })

    await expect(page.locator('input#email')).toBeVisible()
    await expect(page.locator('input#password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })

  test('passes redirectTo as hidden form input when provided', async ({ page }) => {
    await page.goto('/login?redirectTo=/member/family', {
      waitUntil: 'domcontentloaded',
    })

    const hiddenInput = page.locator('input[name="redirectTo"]')
    await expect(hiddenInput).toHaveValue('/member/family')
  })

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })

    await page.locator('input#email').fill('nonexistent@example.com')
    await page.locator('input#password').fill('wrongpassword123')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 10000 })
  })
})

// ─── Responsive Tests ───────────────────────────────────────────────

test.describe('Login page responsive @pipeline', () => {
  test('login form is usable on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/login', { waitUntil: 'domcontentloaded' })

    await expect(page.locator('input#email')).toBeVisible()
    await expect(page.locator('input#password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    await expect(page.locator('img[alt*="St. Basil"]')).toBeVisible()
  })
})
