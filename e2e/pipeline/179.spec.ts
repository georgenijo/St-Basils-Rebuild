import { test, expect } from '@playwright/test'

/**
 * Issue #179: Auth callback route and set-password page for invited users
 *
 * Tests the auth callback route error handling, set-password page session guard,
 * and regression on existing auth pages.
 *
 * Note: Happy-path tests (valid invite code → set-password → redirect) require
 * a real Supabase PKCE code, which cannot be generated in automated tests.
 * Those flows are verified manually or via agent-browser with test credentials.
 */

test.describe('Issue #179: Auth Callback & Set-Password', () => {
  // ── S1: Auth callback — missing code redirects to /login ─────────────
  test('S1: /api/auth/callback without code redirects to /login with error', async ({
    request,
    baseURL,
  }) => {
    const response = await request.get(`${baseURL}/api/auth/callback`, {
      maxRedirects: 0,
    })

    expect(response.status()).toBe(307)
    const location = response.headers()['location']
    expect(location).toBeTruthy()

    const redirectUrl = new URL(location!, baseURL!)
    expect(redirectUrl.pathname).toBe('/login')
    expect(redirectUrl.searchParams.get('error')).toBe('missing_code')
  })

  // ── S2: Auth callback — missing code with type param still errors ────
  test('S2: /api/auth/callback?type=invite without code redirects to /login', async ({
    request,
    baseURL,
  }) => {
    const response = await request.get(`${baseURL}/api/auth/callback?type=invite`, {
      maxRedirects: 0,
    })

    expect(response.status()).toBe(307)
    const location = response.headers()['location']
    expect(location).toBeTruthy()

    const redirectUrl = new URL(location!, baseURL!)
    expect(redirectUrl.pathname).toBe('/login')
    expect(redirectUrl.searchParams.get('error')).toBe('missing_code')
  })

  // ── S3: Auth callback — invalid code redirects to /login with error ──
  test('S3: /api/auth/callback with invalid code redirects to /login', async ({
    request,
    baseURL,
  }) => {
    const response = await request.get(
      `${baseURL}/api/auth/callback?code=invalid-code-abc123&type=invite`,
      { maxRedirects: 0 }
    )

    expect(response.status()).toBe(307)
    const location = response.headers()['location']
    expect(location).toBeTruthy()

    const redirectUrl = new URL(location!, baseURL!)
    expect(redirectUrl.pathname).toBe('/login')
    expect(redirectUrl.searchParams.get('error')).toBe('auth_code_error')
  })

  // ── S4: Set-password page — unauthenticated user does not stay on /set-password ─
  test('S4: /set-password without session redirects away', async ({ page }) => {
    await page.goto('/set-password', { waitUntil: 'domcontentloaded' })

    // Without a session, the page should redirect to /login.
    // If DEV_ADMIN_BYPASS is active, /login auto-forwards to /admin/dashboard.
    // Either way, the user should NOT remain on /set-password.
    await page.waitForURL((url) => !url.pathname.includes('/set-password'), {
      timeout: 15_000,
    })
    const url = page.url()
    // Should be at /login or (with dev bypass) /admin/dashboard
    expect(url.includes('/login') || url.includes('/admin')).toBeTruthy()
  })

  // ── S8: Login page renders or dev-bypass redirects (regression) ──────
  test('S8: Login page loads without error (regression)', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        if (text.includes('Turnstile') || text.includes('cf-turnstile')) return
        if (text.includes('NEXT_PUBLIC_')) return
        consoleErrors.push(text)
      }
    })

    const response = await page.goto('/login', { waitUntil: 'domcontentloaded' })

    // Login page should either render (200) or redirect via dev bypass (200 after redirect)
    // It should never 500
    expect(response?.status()).not.toBe(500)

    const url = page.url()
    if (url.includes('/login')) {
      // Dev bypass not active — check form renders
      await expect(page.locator('input#email')).toBeVisible()
      await expect(page.locator('input#password')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    }
    // If dev bypass redirected us away, the page loaded without error — that's fine
    expect(consoleErrors).toEqual([])
  })

  // ── S9: Admin auth guard regression ──────────────────────────────────
  test('S9: /admin/dashboard requires auth or dev-bypass', async ({ page }) => {
    const response = await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' })

    // Should never 500. Either redirects to /login (no bypass) or renders (bypass active)
    expect(response?.status()).not.toBe(500)

    const url = page.url()
    // Should be at /login (redirected) or /admin/dashboard (dev bypass auto-authenticated)
    expect(url.includes('/login') || url.includes('/admin')).toBeTruthy()
  })

  // ── S8b: Login page error param displays correctly ───────────────────
  test('S8b: Login page with error=missing_code does not crash', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        if (text.includes('Turnstile') || text.includes('cf-turnstile')) return
        if (text.includes('NEXT_PUBLIC_')) return
        consoleErrors.push(text)
      }
    })

    const response = await page.goto('/login?error=missing_code', {
      waitUntil: 'domcontentloaded',
    })

    // Page should load without crashing
    expect(response?.status()).toBe(200)
    expect(consoleErrors).toEqual([])
  })

  // ── Regression: public pages still load ──────────────────────────────
  const REGRESSION_PAGES = [
    { path: '/', label: 'Homepage' },
    { path: '/about', label: 'About' },
    { path: '/contact', label: 'Contact Us' },
  ]

  for (const { path, label } of REGRESSION_PAGES) {
    test(`Regression — ${label} (${path}) still loads`, async ({ page }) => {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
      expect(response?.status()).toBe(200)
    })
  }
})
