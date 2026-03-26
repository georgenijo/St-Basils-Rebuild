import { test, expect } from '@playwright/test'

/**
 * Smoke: Contact form + newsletter signup form render correctly.
 *
 * Does not submit (requires Turnstile + server), but verifies
 * all fields and the submit button are present.
 */

test.describe('Contact form @smoke', () => {
  test('renders all fields and submit button', async ({ page }) => {
    await page.goto('/contact', { waitUntil: 'domcontentloaded' })

    // All form fields present
    await expect(page.locator('input#name')).toBeVisible()
    await expect(page.locator('input#email')).toBeVisible()
    await expect(page.locator('input#subject')).toBeVisible()
    await expect(page.locator('textarea#message')).toBeVisible()

    // Labels present
    await expect(page.locator('label[for="name"]')).toContainText('Name')
    await expect(page.locator('label[for="email"]')).toContainText('Email')
    await expect(page.locator('label[for="subject"]')).toContainText('Subject')
    await expect(page.locator('label[for="message"]')).toContainText('Message')

    // Submit button
    await expect(page.getByRole('button', { name: 'Send Message' })).toBeVisible()

    // Honeypot field is hidden
    const honeypot = page.locator('input#website')
    await expect(honeypot).toBeHidden()
  })

  test('fields have required attribute', async ({ page }) => {
    await page.goto('/contact', { waitUntil: 'domcontentloaded' })

    for (const id of ['name', 'email', 'subject', 'message']) {
      const field = id === 'message' ? page.locator(`textarea#${id}`) : page.locator(`input#${id}`)
      await expect(field).toHaveAttribute('required', '')
    }
  })
})

test.describe('Newsletter signup form @smoke', () => {
  test('renders email input and subscribe button in footer', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    const footer = page.locator('footer')

    // Email input for newsletter
    const emailInput = footer.locator('input#newsletter-email')
    await expect(emailInput).toBeVisible()
    await expect(emailInput).toHaveAttribute('type', 'email')
    await expect(emailInput).toHaveAttribute('required', '')

    // Subscribe button
    await expect(footer.getByRole('button', { name: 'Subscribe' })).toBeVisible()

    // Honeypot hidden
    await expect(footer.locator('input#newsletter-website')).toBeHidden()
  })
})
