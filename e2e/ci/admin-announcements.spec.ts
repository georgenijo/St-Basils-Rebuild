import { expect, test } from '@playwright/test'

import {
  clearMockEmails,
  ensureConfirmedSubscriber,
  fetchAnnouncementBySlug,
  fetchSubscriberByEmail,
  loginAsSeedAdmin,
  slugify,
  uniqueEmail,
  waitForMockEmail,
} from '../helpers/test-support'

test.describe('CI admin announcements', () => {
  test.beforeEach(async ({ request }) => {
    await clearMockEmails(request)
  })

  test('published announcement emails contain a working unsubscribe link', async ({
    page,
    request,
  }) => {
    const subscriberEmail = uniqueEmail('announcement')
    await ensureConfirmedSubscriber(subscriberEmail)

    const title = `CI Announcement ${Date.now()}`
    const slug = slugify(title)

    await loginAsSeedAdmin(page)
    await page.waitForURL('**/admin/**')

    await page.goto('/admin/announcements/new', { waitUntil: 'domcontentloaded' })
    await page.locator('input#title').fill(title)
    await page.getByRole('switch', { name: 'Send email notification' }).click()
    await page.getByRole('switch', { name: 'Publish announcement' }).click()
    await page.getByRole('button', { name: 'Create Announcement' }).click()

    await page.waitForURL('**/admin/announcements')

    const announcement = await fetchAnnouncementBySlug(slug)
    expect(announcement.published_at).toBeTruthy()
    expect(announcement.send_email).toBe(true)

    const triggerResponse = await request.post('/api/test/announcement-broadcast', {
      headers: { 'x-test-secret': process.env.TEST_SUPPORT_SECRET || 'test-support-secret' },
      data: { announcementId: announcement.id },
    })
    expect(triggerResponse.ok()).toBeTruthy()

    const email = await waitForMockEmail(request, {
      template: 'announcement-broadcast',
      to: subscriberEmail,
    })

    expect(email.metadata.announcementUrl).toContain(`/announcements/${slug}`)
    expect(email.metadata.unsubscribeUrl).toContain('/api/newsletter/unsubscribe?token=')

    await page.goto('/announcements', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(title)).toBeVisible()

    await page.goto(email.metadata.unsubscribeUrl!, { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/unsubscribed=success/)

    const subscriber = await fetchSubscriberByEmail(subscriberEmail)
    expect(subscriber.unsubscribed_at).toBeTruthy()
  })
})
