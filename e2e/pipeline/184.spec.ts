import { test, expect } from '@playwright/test'

test.describe('Issue #184: transactional notification emails', () => {
  test('S1 — cron route rejects missing Authorization header', async ({ request }) => {
    const response = await request.get('/api/cron/dues-reminders')
    expect(response.status()).toBe(401)
    const body = await response.json()
    expect(body).toMatchObject({ error: 'unauthorized' })
  })

  test('S2 — cron route rejects wrong bearer token', async ({ request }) => {
    const response = await request.get('/api/cron/dues-reminders', {
      headers: { authorization: 'Bearer wrong-secret-value' },
    })
    expect(response.status()).toBe(401)
  })

  test('S3 — cron route rejects literal "Bearer undefined" (fail-closed regression)', async ({
    request,
  }) => {
    const response = await request.get('/api/cron/dues-reminders', {
      headers: { authorization: 'Bearer undefined' },
    })
    expect(response.status()).toBe(401)
  })

  test('S4 — /member/settings redirects unauthenticated visitors to /login', async ({ page }) => {
    const response = await page.goto('/member/settings', { waitUntil: 'domcontentloaded' })
    expect(response).not.toBeNull()
    expect(page.url()).toContain('/login')
  })
})
