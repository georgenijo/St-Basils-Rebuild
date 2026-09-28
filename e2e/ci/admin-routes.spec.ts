import { expect, test } from '@playwright/test'

import { loginAsSeedAdmin } from '../helpers/test-support'

/**
 * Regression coverage for PR #295: a bad admin-table-config import crashed
 * /admin/events and /admin/announcements with a 500 under the real React
 * Server Components runtime, yet the Browser Flow Tests job stayed green
 * because admin-events.spec.ts / admin-announcements.spec.ts only assert
 * `page.waitForURL(...)` after a form submit — which resolves even when the
 * destination response is a 500 — and e2e/smoke/admin.spec.ts only exercises
 * these routes unauthenticated (redirect-to-login assertions). This spec logs
 * in as the seeded admin and hits each admin list route directly, asserting
 * the response is not a server error and the page actually rendered.
 *
 * Route selection: every admin/*\/page.tsx list route is included EXCEPT:
 * - `/admin` itself, which only `redirect()`s to `/admin/dashboard` (which is
 *   in the list) and has no content of its own to assert against.
 * - `/admin/events/new`, `/admin/announcements/new`, `/admin/users/invite`,
 *   etc. — these are create/edit forms, not the list routes this spec targets.
 *   `/admin/events/calendar` IS included: it is a read-only list view.
 *
 * `/admin/logs` and `/admin/health` were checked against
 * .github/workflows/ci.yml's Browser Flow Tests env, which provides a local
 * Supabase stack but no VERCEL_ACCESS_TOKEN/VERCEL_PROJECT_ID/VERCEL_TEAM_ID
 * and no external status-page credentials:
 * - `/admin/logs` (src/lib/vercel-logs.server.ts) checks
 *   `getVercelLogViewerConfiguration()` and only calls the Vercel API when
 *   all three env vars are present; otherwise it renders a "Setup required"
 *   state server-side with no network call, so it's safe to include here —
 *   in CI this route only ever exercises that unconfigured-state render.
 * - `/admin/health` reads `NEXT_PUBLIC_STATUS_PAGE_URL` only to build an
 *   optional link, and the actual dependency probing happens client-side via
 *   `HealthStatusCard` fetching `/api/health` after hydration, so the initial
 *   server render never depends on external creds. Included.
 */

const ADMIN_LIST_ROUTES = [
  '/admin/dashboard',
  '/admin/events',
  '/admin/events/calendar',
  '/admin/announcements',
  '/admin/families',
  '/admin/health',
  '/admin/logs',
  '/admin/payments',
  '/admin/requests',
  '/admin/requests/new',
  '/admin/settings',
  '/admin/shares',
  '/admin/subscribers',
  '/admin/users',
]

test.describe('CI admin routes', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSeedAdmin(page)
    await page.waitForURL('**/admin/**')
  })

  for (const route of ADMIN_LIST_ROUTES) {
    test(`${route} renders for an authenticated admin`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' })

      expect(response?.status() ?? 0).toBeLessThan(500)
      expect(page.url()).not.toContain('/login')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    })
  }
})
