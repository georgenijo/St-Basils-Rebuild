import { expect, test } from '@playwright/test'

import {
  clearMockEmails,
  fetchSubscriberByEmail,
  uniqueEmail,
  waitForMockEmail,
} from '../helpers/test-support'

test.describe('CI forms and newsletter', () => {
  test.beforeEach(async ({ request }) => {
    await clearMockEmails(request)
  })

  test('contact form submits and sends a notification email', async ({ page, request }) => {
    const subject = `CI Contact Subject ${Date.now()}`

    await page.goto('/contact', { waitUntil: 'domcontentloaded' })
    await page.locator('input#name').fill('CI Contact User')
    await page.locator('input#email').fill('contact-ci@example.com')
    await page.locator('input#subject').fill(subject)
    await page.locator('textarea#message').fill('This message was submitted by the CI suite.')
    await page.getByRole('button', { name: 'Send Message' }).click()

    await expect(page.getByRole('heading', { name: 'Message Sent' })).toBeVisible()

    const email = await waitForMockEmail(request, {
      template: 'contact-notification',
      subject,
    })

    expect(email.to).toContain('info@stbasilsboston.org')
    expect(email.metadata.subject).toBe(subject)
  })

  test('newsletter signup can be confirmed and unsubscribed', async ({ page, request }) => {
    const emailAddress = uniqueEmail('newsletter')

    await page.goto('/', { waitUntil: 'domcontentloaded' })

    const footer = page.locator('footer')
    await footer.locator('input#newsletter-email').fill(emailAddress)
    await footer.getByRole('button', { name: 'Subscribe' }).click()

    await expect(page.getByRole('status')).toContainText('A confirmation email has been sent')

    const confirmationEmail = await waitForMockEmail(request, {
      template: 'newsletter-confirmation',
      to: emailAddress,
    })

    const confirmUrl = confirmationEmail.metadata.confirmUrl
    expect(confirmUrl).toBeTruthy()

    await page.goto(confirmUrl!, { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/confirmed=success/)

    const confirmedSubscriber = await fetchSubscriberByEmail(emailAddress)
    expect(confirmedSubscriber.confirmed).toBe(true)
    expect(confirmedSubscriber.unsubscribed_at).toBeNull()

    const unsubscribeUrl = `${process.env.BASE_URL || 'http://127.0.0.1:3000'}/api/newsletter/unsubscribe?token=${confirmedSubscriber.unsubscribe_token}`
    await page.goto(unsubscribeUrl, { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/unsubscribed=success/)

    const unsubscribedSubscriber = await fetchSubscriberByEmail(emailAddress)
    expect(unsubscribedSubscriber.unsubscribed_at).toBeTruthy()
  })
})
