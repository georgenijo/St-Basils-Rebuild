import { expect, test } from '@playwright/test'

import {
  clearMockEmails,
  getAdminClient,
  loginAsSeedAdmin,
  waitForMockEmail,
  waitForReactHydration,
} from '../helpers/test-support'

// 1x1 transparent PNG.
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
)

// A 5 MB PDF: larger than Vercel's 4.5 MB function body limit and the default
// 1 MB server-action limit, so it only succeeds via direct-to-Storage upload.
const LARGE_PDF_BYTES = Buffer.concat([
  Buffer.from('%PDF-1.4\n'),
  Buffer.alloc(5 * 1024 * 1024, 0x20),
])

const PICKER_FRAME = 'iframe[title="Page preview for element picker"]'

test.describe('CI admin website change requests', () => {
  const createdIds: string[] = []

  test.beforeEach(async ({ request }) => {
    await clearMockEmails(request)
  })

  test.afterAll(async () => {
    if (createdIds.length === 0) return
    const supabase = getAdminClient()
    const { data: files } = await supabase
      .from('change_request_files')
      .select('storage_path')
      .in('request_id', createdIds)
    const paths = (files ?? []).map((file) => file.storage_path as string)
    if (paths.length > 0) await supabase.storage.from('change-requests').remove(paths)
    await supabase.from('change_requests').delete().in('id', createdIds)
  })

  test('admin submits a request with a picked element and direct-uploaded attachments', async ({
    page,
    request,
  }) => {
    // Covers login, the framed page preview, and a 5 MB upload.
    test.setTimeout(90_000)
    const title = `CI change request ${Date.now()}-${Math.round(Math.random() * 1000)}`

    await loginAsSeedAdmin(page)
    await page.waitForURL('**/admin/**')

    await page.goto('/admin/requests/new', { waitUntil: 'domcontentloaded' })
    const submit = page.getByRole('button', { name: 'Submit request' })
    await waitForReactHydration(submit)

    await expect(page.getByTestId('change-request-privacy-notice')).toContainText(
      'public GitHub pull request'
    )
    await page.locator('input#title').fill(title)
    await page
      .locator('textarea#description')
      .fill('Please update the contact link wording in the footer to "Contact the parish office".')

    const pickButton = page.getByRole('button', { name: 'Pick element' })
    const canPick = await pickButton.isVisible()
    if (canPick) {
      const frame = page.frameLocator(PICKER_FRAME)
      const contactLink = frame.locator('footer a[href="/contact"]').first()
      await expect(contactLink).toBeVisible({ timeout: 20_000 })

      await pickButton.click()
      await expect(page.getByRole('button', { name: 'Cancel picking' })).toBeVisible()
      await contactLink.click()

      const picked = page.getByTestId('picked-element')
      await expect(picked).toBeVisible()
      await expect(picked).toContainText('Link <a>')
      // Picking must not follow the link inside the preview.
      expect(
        await page
          .locator(PICKER_FRAME)
          .evaluate((el) => (el as HTMLIFrameElement).contentWindow?.location.pathname)
      ).toBe('/')
    } else {
      await page.locator('input#target_text_mobile').fill('Contact')
    }

    await page.locator('input#attachments').setInputFiles([
      { name: 'new flyer.png', mimeType: 'image/png', buffer: PNG_BYTES },
      { name: 'Order of service.pdf', mimeType: 'application/pdf', buffer: LARGE_PDF_BYTES },
    ])
    await expect(page.getByRole('img', { name: 'Preview of new flyer.png' })).toBeVisible()

    // Files must go straight to Storage; the form submission carries only paths.
    const storageUploads: string[] = []
    let largestActionBody = 0
    page.on('request', (req) => {
      const url = new URL(req.url())
      if (req.method() === 'PUT' && url.pathname.includes('/storage/v1/object/upload/sign/')) {
        storageUploads.push(decodeURIComponent(url.pathname.split('/change-requests/')[1] ?? ''))
      }
      if (req.method() === 'POST' && req.headers()['next-action']) {
        largestActionBody = Math.max(largestActionBody, req.postDataBuffer()?.byteLength ?? 0)
      }
    })

    await submit.click()
    await page.waitForURL(/\/admin\/requests\/[0-9a-f-]{36}$/, { timeout: 60_000 })
    const requestId = page.url().split('/').pop()!
    createdIds.push(requestId)

    await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible()
    await expect(page.getByTestId('change-request-status')).toContainText('Queued')
    await expect(page.getByRole('link', { name: 'new-flyer.png', exact: true })).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Order-of-service.pdf', exact: true })
    ).toBeVisible()
    // The attachment renders through a server-minted signed Storage URL.
    const thumbnail = page.getByRole('img', { name: 'Preview of new-flyer.png' })
    await expect(thumbnail).toBeVisible()
    await expect
      .poll(() => thumbnail.evaluate((img) => (img as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0)

    expect(storageUploads).toHaveLength(2)
    storageUploads.forEach((path) => expect(path).toMatch(/^pending\/[0-9a-f-]{36}\//))
    expect(largestActionBody).toBeGreaterThan(0)
    expect(largestActionBody).toBeLessThan(64 * 1024)

    const supabase = getAdminClient()
    // Pending uploads were moved into the request folder, not copied.
    const pendingFolder = storageUploads[0].split('/').slice(0, 2).join('/')
    const { data: leftovers } = await supabase.storage.from('change-requests').list(pendingFolder)
    expect(leftovers ?? []).toHaveLength(0)

    const { data: row } = await supabase
      .from('change_requests')
      .select('page_path, target_selector, target_text, status')
      .eq('id', requestId)
      .single()
    // Two-phase submit: inserted as 'submitting', flipped to 'queued' once
    // the file rows exist. No worker runs in CI, so it stays queued.
    expect(row?.status).toBe('queued')
    expect(row?.page_path).toBe('/')
    if (canPick) expect(row?.target_selector).toBeTruthy()
    expect(row?.target_text).toContain('Contact')

    const { data: files } = await supabase
      .from('change_request_files')
      .select('kind, content_type, storage_path, filename, size_bytes')
      .eq('request_id', requestId)
    expect(files).toHaveLength(2)
    const byName = (name: string) => files?.find((file) => file.filename === name)
    expect(byName('Order-of-service.pdf')).toMatchObject({
      kind: 'attachment',
      content_type: 'application/pdf',
      size_bytes: LARGE_PDF_BYTES.byteLength,
    })
    expect(byName('new-flyer.png')).toMatchObject({
      kind: 'attachment',
      content_type: 'image/png',
      size_bytes: PNG_BYTES.byteLength,
    })
    for (const file of files ?? []) {
      expect(file.storage_path).toMatch(
        new RegExp(`^requests/${requestId}/attachments/[0-9a-f-]{36}-${file.filename}$`)
      )
    }

    const email = await waitForMockEmail(request, {
      template: 'change-request-notification',
      subject: title,
    })
    expect(email.metadata.requestId).toBe(requestId)
    expect(email.metadata.requestUrl).toContain(`/admin/requests/${requestId}`)
    expect(email.subject).toContain(title)

    await page.goto('/admin/requests', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('link', { name: title })).toBeVisible()
  })
  test('warns before submitting a request that mentions a missing attachment', async ({ page }) => {
    test.setTimeout(60_000)
    // Neutral title, so the warning must come from the description.
    const title = `CI request ${Date.now()}-${Math.round(Math.random() * 1000)}`

    await loginAsSeedAdmin(page)
    await page.waitForURL('**/admin/**')

    await page.goto('/admin/requests/new', { waitUntil: 'domcontentloaded' })
    const submit = page.getByRole('button', { name: 'Submit request' })
    await waitForReactHydration(submit)

    const warning = page.getByTestId('change-request-missing-attachment')
    await page.locator('input#title').fill(title)
    await page
      .locator('textarea#description')
      .fill('Replace the feast flyer on the home page, use the attached image.')
    await expect(warning).toContainText('nothing is attached')

    // First submit stops at the warning instead of queueing the request.
    await submit.click()
    await expect(warning).toBeFocused()
    await expect(warning).toContainText('submit again to send the request without it')
    await expect(page).toHaveURL(/\/admin\/requests\/new/)
    const submitAnyway = page.getByRole('button', { name: 'Submit without attachment' })
    await expect(submitAnyway).toBeVisible()

    // Attaching a file clears the warning and shows its thumbnail.
    await page
      .locator('input#attachments')
      .setInputFiles([{ name: 'feast flyer.png', mimeType: 'image/png', buffer: PNG_BYTES }])
    await expect(warning).toBeHidden()
    const preview = page.getByRole('img', { name: 'Preview of feast flyer.png' })
    await expect(preview).toBeVisible()
    await expect
      .poll(() => preview.evaluate((img) => (img as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0)
    await expect(submit).toBeVisible()

    // Removing it brings the warning back; the requester already confirmed,
    // so the next submit goes through without a file.
    await page.getByRole('button', { name: 'Remove feast flyer.png' }).click()
    await expect(warning).toBeVisible()
    await submitAnyway.click()
    await page.waitForURL(/\/admin\/requests\/[0-9a-f-]{36}$/, { timeout: 30_000 })
    const requestId = page.url().split('/').pop()!
    createdIds.push(requestId)
    await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible()

    const { data: files } = await getAdminClient()
      .from('change_request_files')
      .select('id')
      .eq('request_id', requestId)
    expect(files).toHaveLength(0)
  })
})
