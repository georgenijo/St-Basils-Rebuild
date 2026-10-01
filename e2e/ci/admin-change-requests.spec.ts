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
    // No verification yet: the evidence panel explains what will appear.
    await expect(page.getByTestId('change-request-evidence-empty')).toContainText(
      'once the agent has verified the change'
    )
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

  test('request detail streams its thread and evidence and serves cached thumbnails', async ({
    page,
    playwright,
  }) => {
    const supabase = getAdminClient()
    const { data: admin } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', 'admin@stbasilsboston.org')
      .single()
    const title = `CI evidence request ${Date.now()}-${Math.round(Math.random() * 1000)}`
    const { data: seeded, error } = await supabase
      .from('change_requests')
      .insert({
        requester_id: admin!.id,
        title,
        description: 'Update the Sunday service times on the home page.',
        page_path: '/',
        status: 'ready_for_review',
        verification: { verdict: 'pass', summary: 'Service times updated.' },
      })
      .select('id')
      .single()
    expect(error).toBeNull()
    const requestId = seeded!.id as string
    createdIds.push(requestId)

    await supabase.from('change_request_messages').insert([
      { request_id: requestId, author_kind: 'requester', author_id: admin!.id, body: 'Please.' },
      { request_id: requestId, author_kind: 'agent', body: 'Preview verified.' },
    ])
    const shotPath = `requests/${requestId}/verification/after.png`
    await supabase.storage
      .from('change-requests')
      .upload(shotPath, PNG_BYTES, { contentType: 'image/png', upsert: true })
    await supabase.from('change_request_files').insert({
      request_id: requestId,
      kind: 'verification',
      storage_path: shotPath,
      filename: 'after.png',
      content_type: 'image/png',
      size_bytes: PNG_BYTES.byteLength,
      label: 'After: home page',
    })

    await loginAsSeedAdmin(page)
    await page.waitForURL('**/admin/**')
    await page.goto('/admin/requests', { waitUntil: 'domcontentloaded' })
    await page.getByRole('link', { name: title }).click()
    await page.waitForURL(`**/admin/requests/${requestId}`)

    await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible()
    await expect(page.getByTestId('change-request-thread')).toContainText('Preview verified.')
    await expect(page.getByTestId('verification-verdict')).toBeVisible()

    // Screenshots render from the small, stable thumbnail route and link to
    // the full-size signed Storage URL.
    const shot = page.getByRole('img', { name: 'After: home page' })
    await expect(shot).toHaveAttribute(
      'src',
      new RegExp(`^/admin/requests/${requestId}/files/[0-9a-f-]{36}/thumbnail$`)
    )
    await expect
      .poll(() => shot.evaluate((img) => (img as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0)
    await expect(page.locator('a', { has: shot })).toHaveAttribute(
      'href',
      /\/storage\/v1\/object\/sign\/change-requests\//
    )

    const thumbnailUrl = (await shot.getAttribute('src'))!
    const thumbnail = await page.request.get(thumbnailUrl)
    expect(thumbnail.status()).toBe(200)
    expect(thumbnail.headers()['content-type']).toBe('image/webp')
    expect(thumbnail.headers()['cache-control']).toBe('private, no-cache')
    const etag = thumbnail.headers()['etag']
    expect(etag).toBeTruthy()
    // Revalidation is authorized and cheap: same session gets a 304.
    const revalidated = await page.request.get(thumbnailUrl, {
      headers: { 'If-None-Match': etag },
    })
    expect(revalidated.status()).toBe(304)

    // Without an admin session the thumbnail route reveals nothing.
    const anonymous = await playwright.request.newContext({
      baseURL: new URL(page.url()).origin,
    })
    try {
      // Even with a cached copy's ETag, a signed-out browser gets no 304.
      const denied = await anonymous.get(thumbnailUrl, {
        maxRedirects: 0,
        headers: { 'If-None-Match': etag },
      })
      expect([302, 303, 307, 404]).toContain(denied.status())
      expect(denied.headers()['content-type'] ?? '').not.toContain('image/')
    } finally {
      await anonymous.dispose()
    }

    await page.getByRole('link', { name: 'Back to Requests' }).click()
    await expect(page.getByRole('link', { name: title })).toBeVisible()
  })

  test('admin requests changes on a ready request, or leaves a plain note', async ({ page }) => {
    const supabase = getAdminClient()
    const { data: admin } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', 'admin@stbasilsboston.org')
      .single()
    const verifiedSha = 'ab12'.repeat(10)
    const title = `CI revision request ${Date.now()}-${Math.round(Math.random() * 1000)}`
    const { data: row, error } = await supabase
      .from('change_requests')
      .insert({
        requester_id: admin!.id,
        title,
        description: 'Please update the welcome heading on the homepage.',
        page_path: '/',
        status: 'ready_for_review',
        branch_name: 'change-request/ci000000-website-update',
        pr_number: 9999,
        pr_url: 'https://github.com/georgenijo/St-Basils-Rebuild/pull/9999',
        verification: {
          verdict: 'pass',
          summary: 'Heading updated.',
          checks: [],
          commit_sha: verifiedSha,
        },
      })
      .select('id')
      .single()
    expect(error).toBeNull()
    const requestId = row!.id as string
    createdIds.push(requestId)

    await loginAsSeedAdmin(page)
    await page.waitForURL('**/admin/**')
    await page.goto(`/admin/requests/${requestId}`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('change-request-status')).toContainText('Ready for review')

    // A plain reply is only a note: the request stays ready and nothing is requeued.
    const intent = page.getByTestId('reply-intent')
    await expect(intent.getByRole('radio', { name: /Add a note/ })).toBeChecked()
    const saveNote = page.getByRole('button', { name: 'Save note' })
    await waitForReactHydration(saveNote)
    await page.locator('textarea#reply-body').fill('Looks good to me.')
    await saveNote.click()
    await expect(page.locator('.cr-reply [role="status"]')).toContainText('Reply posted.')
    const note = page.locator('.cr-message', { hasText: 'Looks good to me.' })
    await expect(note.locator('.admin-status')).toHaveText('Note')
    const { data: afterNote } = await supabase
      .from('change_requests')
      .select('status, revision_base_sha')
      .eq('id', requestId)
      .single()
    expect(afterNote).toEqual({ status: 'ready_for_review', revision_base_sha: null })

    // A form left open after the request stopped being ready saves nothing.
    await intent.getByRole('radio', { name: /Request changes/ }).check()
    await page.locator('textarea#reply-body').fill('A stale request for changes.')
    await supabase.from('change_requests').update({ status: 'verifying' }).eq('id', requestId)
    await page.getByRole('button', { name: 'Request changes' }).click()
    await expect(page.locator('.cr-reply [role="alert"]')).toContainText(
      'no longer ready for review, so nothing was saved'
    )
    const { count: staleCount } = await supabase
      .from('change_request_messages')
      .select('id', { count: 'exact', head: true })
      .eq('request_id', requestId)
      .eq('body', 'A stale request for changes.')
    expect(staleCount).toBe(0)
    await supabase
      .from('change_requests')
      .update({ status: 'ready_for_review' })
      .eq('id', requestId)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForReactHydration(page.getByRole('button', { name: 'Save note' }))

    // "Request changes" requeues it on top of the verified commit.
    await intent.getByRole('radio', { name: /Request changes/ }).check()
    await page.locator('textarea#reply-body').fill('Make the heading a little bigger.')
    await page.getByRole('button', { name: 'Request changes' }).click()
    await expect(page.locator('.cr-reply [role="status"]')).toContainText('Changes requested.')
    await expect(page.getByTestId('change-request-status')).toContainText('Queued')
    await expect(page.locator('.cr-thread')).toContainText(
      'The agent will revise pull request #9999'
    )
    await expect(page.getByTestId('reply-intent')).toHaveCount(0)
    const revision = page.locator('.cr-message', { hasText: 'Make the heading a little bigger.' })
    await expect(revision.locator('.admin-status')).toHaveText('Requested changes')

    const { data: afterRevision } = await supabase
      .from('change_requests')
      .select('status, revision_base_sha, claimed_by')
      .eq('id', requestId)
      .single()
    expect(afterRevision).toEqual({
      status: 'queued',
      revision_base_sha: verifiedSha,
      claimed_by: null,
    })
    const { data: intents } = await supabase
      .from('change_request_messages')
      .select('body, intent')
      .eq('request_id', requestId)
      .eq('author_kind', 'requester')
      .order('created_at')
    expect(intents).toEqual([
      { body: 'Looks good to me.', intent: 'note' },
      { body: 'Make the heading a little bigger.', intent: 'revision' },
    ])
  })

  test('conversation reads as a timeline with clickable PR and preview links', async ({ page }) => {
    const supabase = getAdminClient()
    const { data: admin } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', 'admin@stbasilsboston.org')
      .single()
    const prUrl = 'https://github.com/georgenijo/St-Basils-Rebuild/pull/4242'
    const previewUrl = 'https://st-basils-ci-preview.vercel.app'
    const title = `CI timeline request ${Date.now()}-${Math.round(Math.random() * 1000)}`
    const { data: seeded, error } = await supabase
      .from('change_requests')
      .insert({
        requester_id: admin!.id,
        title,
        description: 'Fix the footer link.',
        page_path: '/',
        status: 'ready_for_review',
        pr_number: 4242,
        pr_url: prUrl,
        preview_url: previewUrl,
      })
      .select('id')
      .single()
    expect(error).toBeNull()
    const requestId = seeded!.id as string
    createdIds.push(requestId)

    const at = (minute: number) => new Date(Date.UTC(2026, 8, 30, 12, minute)).toISOString()
    await supabase.from('change_request_messages').insert([
      {
        request_id: requestId,
        author_kind: 'requester',
        author_id: admin!.id,
        body: 'Please see https://example.org/footer-spec. Thanks!',
        created_at: at(0),
      },
      {
        request_id: requestId,
        author_kind: 'system',
        body: 'The worker picked up this request and is preparing a change.',
        created_at: at(1),
      },
      {
        request_id: requestId,
        author_kind: 'agent',
        body: 'Updated the footer:\n- changed `Footer.tsx`\n- kept the layout\n\n<script>alert(1)</script>',
        created_at: at(2),
      },
      {
        request_id: requestId,
        author_kind: 'system',
        body: `Opened pull request #4242: ${prUrl}\nIt opens as a draft and is marked ready for review automatically once CI checks and the Vercel preview verification both pass.`,
        created_at: at(3),
      },
      {
        request_id: requestId,
        author_kind: 'system',
        body: 'CI checks passed on pull request #4242 (commit abc1234); verifying the preview next.',
        created_at: at(4),
      },
      {
        request_id: requestId,
        author_kind: 'system',
        body: `Preview verified (pass): The footer link works.\nPreview: ${previewUrl}/`,
        created_at: at(5),
      },
    ])

    await loginAsSeedAdmin(page)
    await page.waitForURL('**/admin/**')
    await page.goto(`/admin/requests/${requestId}`, { waitUntil: 'domcontentloaded' })

    const thread = page.getByRole('list', { name: 'Request timeline' })
    await expect(thread).toBeVisible()

    // Requester and agent messages are distinct bubbles.
    await expect(thread.locator('.cr-message[data-kind="requester"]')).toContainText('Please see')
    const agent = thread.locator('.cr-message[data-kind="agent"]')
    await expect(agent).toContainText('Website agent')
    await expect(agent.locator('li')).toHaveText(['changed Footer.tsx', 'kept the layout'])
    await expect(agent.locator('code')).toHaveText('Footer.tsx')
    // Message text is escaped, never interpreted as markup.
    await expect(agent).toContainText('<script>alert(1)</script>')

    // Plain URLs are clickable and open in a new tab.
    const specLink = thread.getByRole('link', { name: /example\.org\/footer-spec/ })
    await expect(specLink).toHaveAttribute('href', 'https://example.org/footer-spec')
    await expect(specLink).toHaveAttribute('target', '_blank')
    await expect(specLink).toHaveAttribute('rel', 'noopener noreferrer')

    // System events are compact rows with PR / preview buttons.
    await expect(thread.locator('.cr-event[data-event="picked_up"]')).toContainText(
      'Picked up by the website agent'
    )
    const opened = thread.locator('.cr-event[data-event="pr_opened"]')
    await expect(opened).toContainText('PR #4242 opened')
    await expect(opened.getByRole('link', { name: /View PR #4242/ })).toHaveAttribute('href', prUrl)
    await expect(thread.locator('.cr-event[data-event="ci_passed"]')).toContainText(
      'CI passed (abc1234)'
    )
    const verified = thread.locator('.cr-event[data-event="verified"]')
    await expect(verified).toContainText('Preview verified')
    await expect(verified).toContainText('The footer link works.')
    await expect(verified.getByRole('link', { name: /Open preview/ })).toHaveAttribute(
      'href',
      `${previewUrl}/`
    )
  })

  test('admin closes a request with a reason; closed requests are final', async ({ page }) => {
    const supabase = getAdminClient()
    const { data: admin } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', 'admin@stbasilsboston.org')
      .single()
    const title = `CI close request ${Date.now()}-${Math.round(Math.random() * 1000)}`
    const { data: row, error } = await supabase
      .from('change_requests')
      .insert({
        requester_id: admin!.id,
        title,
        description: 'Please change the footer colour to green.',
        page_path: '/',
        status: 'ready_for_review',
        branch_name: 'change-request/ci000001-website-update',
        pr_number: 9998,
        pr_url: 'https://github.com/georgenijo/St-Basils-Rebuild/pull/9998',
        verification: { verdict: 'pass', summary: 'Footer is green.', checks: [] },
      })
      .select('id')
      .single()
    expect(error).toBeNull()
    const requestId = row!.id as string
    createdIds.push(requestId)

    await loginAsSeedAdmin(page)
    await page.waitForURL('**/admin/**')
    await page.goto(`/admin/requests/${requestId}`, { waitUntil: 'domcontentloaded' })
    const open = page.getByRole('button', { name: 'Close request…' })
    await waitForReactHydration(open)
    // CI has no CHANGE_REQUEST_GITHUB_TOKEN, so merging from the site is hidden.
    await expect(page.getByRole('button', { name: 'Approve & merge' })).toHaveCount(0)
    await open.click()

    const form = page.getByRole('form', { name: 'Close request' })
    await expect(form).toContainText('closes any open pull request and deletes its branch')
    const confirm = form.getByRole('button', { name: 'Close request' })
    await expect(confirm).toBeDisabled()
    await page.locator('textarea#close-reason').fill('We decided to keep the current colours.')
    await confirm.click()

    await expect(page.getByTestId('change-request-status')).toContainText('Closed')
    await expect(page.getByTestId('change-request-actions')).toHaveCount(0)
    await expect(page.getByTestId('change-request-thread')).toContainText(
      'Closed this request: We decided to keep the current colours.'
    )
    await expect(page.getByTestId('change-request-thread')).toContainText(
      'The agent will close any open pull request and delete its branch'
    )

    const { data: closed } = await supabase
      .from('change_requests')
      .select('status, github_cleanup_pending')
      .eq('id', requestId)
      .single()
    expect(closed).toEqual({ status: 'closed', github_cleanup_pending: true })

    // A later reply is only saved, and the database refuses to reopen it.
    await page.locator('textarea#reply-body').fill('Thanks anyway.')
    await page.getByRole('button', { name: 'Send reply' }).click()
    await expect(page.locator('.cr-reply [role="status"]')).toContainText('Reply posted.')
    const { error: reopenError } = await supabase
      .from('change_requests')
      .update({ status: 'queued' })
      .eq('id', requestId)
    expect(reopenError?.message).toContain('is closed')
    const { data: after } = await supabase
      .from('change_requests')
      .select('status')
      .eq('id', requestId)
      .single()
    expect(after?.status).toBe('closed')
  })

  test('header links to the PR and preview, and evidence pairs before/after with a lightbox', async ({
    page,
  }) => {
    const supabase = getAdminClient()
    const { data: admin } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', 'admin@stbasilsboston.org')
      .single()
    const prUrl = 'https://github.com/georgenijo/St-Basils-Rebuild/pull/4343'
    const previewUrl = 'https://st-basils-ci-preview.vercel.app'
    const title = `CI header request ${Date.now()}-${Math.round(Math.random() * 1000)}`
    const { data: seeded, error } = await supabase
      .from('change_requests')
      .insert({
        requester_id: admin!.id,
        title,
        description: 'Fix the about page heading.',
        page_path: '/about',
        status: 'ready_for_review',
        attempts: 2,
        pr_number: 4343,
        pr_url: prUrl,
        preview_url: previewUrl,
        verification: { verdict: 'pass', summary: 'Heading fixed.', commit_sha: 'abcdef1234' },
      })
      .select('id')
      .single()
    expect(error).toBeNull()
    const requestId = seeded!.id as string
    createdIds.push(requestId)

    const shots = ['before · desktop', 'after · desktop', 'before · mobile', 'after · mobile']
    for (const [index, label] of shots.entries()) {
      const path = `requests/${requestId}/verification/${label.replace(' · ', '-')}.png`
      await supabase.storage
        .from('change-requests')
        .upload(path, PNG_BYTES, { contentType: 'image/png', upsert: true })
      await supabase.from('change_request_files').insert({
        request_id: requestId,
        kind: 'verification',
        storage_path: path,
        filename: path.split('/').pop(),
        content_type: 'image/png',
        size_bytes: PNG_BYTES.byteLength,
        label,
        created_at: new Date(Date.UTC(2026, 8, 30, 12, index)).toISOString(),
      })
    }
    const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0])
    const videoPath = `requests/${requestId}/verification/after-desktop.webm`
    await supabase.storage
      .from('change-requests')
      .upload(videoPath, webm, { contentType: 'video/webm', upsert: true })
    await supabase.from('change_request_files').insert({
      request_id: requestId,
      kind: 'verification',
      storage_path: videoPath,
      filename: 'after-desktop.webm',
      content_type: 'video/webm',
      size_bytes: webm.byteLength,
      label: 'after · desktop (recording)',
    })

    await loginAsSeedAdmin(page)
    await page.waitForURL('**/admin/**')
    await page.goto(`/admin/requests/${requestId}`, { waitUntil: 'domcontentloaded' })

    const header = page.getByTestId('change-request-header')
    await expect(header.getByRole('heading', { level: 1 })).toHaveText(title)
    await expect(header.getByTestId('change-request-status')).toContainText('Ready for review')
    await expect(header).toContainText('Attempt 2')
    await expect(header.getByRole('link', { name: /View PR #4343/ })).toHaveAttribute('href', prUrl)
    await expect(header.getByRole('link', { name: /Open preview/ })).toHaveAttribute(
      'href',
      `${previewUrl}/about`
    )
    await expect(header.getByRole('link', { name: 'Evidence' })).toHaveAttribute(
      'href',
      '#evidence'
    )

    const evidence = page.getByTestId('change-request-evidence')
    await expect(evidence.getByTestId('verification-verdict')).toBeVisible()
    for (const viewport of ['desktop', 'mobile']) {
      const row = evidence.locator(`.cr-compare[data-viewport="${viewport}"] img`)
      await expect(row).toHaveCount(2)
      await expect(row.nth(0)).toHaveAttribute('alt', `before · ${viewport}`)
      await expect(row.nth(1)).toHaveAttribute('alt', `after · ${viewport}`)
    }
    await expect(evidence.locator('video')).toHaveCount(1)

    // Wait for hydration before using the lightbox.
    const afterDesktop = evidence.getByRole('link', { name: /after · desktop/ })
    await waitForReactHydration(afterDesktop)
    await afterDesktop.click()
    const dialog = page.getByRole('dialog', { name: 'Screenshot: after · desktop' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('img', { name: 'after · desktop' })).toHaveAttribute(
      'src',
      /\/storage\/v1\/object\/sign\/change-requests\//
    )
    // Tall screenshots scroll in a keyboard-focusable region.
    await expect(
      dialog.getByRole('region', { name: 'after · desktop, scrollable' })
    ).toHaveAttribute('tabindex', '0')
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('dialog', { name: 'Screenshot: before · mobile' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // An expired / failing full-size link shows a recovery action instead of
    // a broken image, and reloading mints fresh signed URLs.
    await page.route('**/storage/v1/object/sign/**', (route) => route.abort())
    await evidence.getByRole('link', { name: /before · desktop/ }).click()
    const failing = page.getByRole('dialog', { name: 'Screenshot: before · desktop' })
    await expect(failing.getByRole('alert')).toContainText('could not load')
    await page.unroute('**/storage/v1/object/sign/**')
    await failing.getByRole('button', { name: 'Reload screenshots' }).click()
    await expect
      .poll(() =>
        failing
          .getByRole('img', { name: 'before · desktop' })
          .evaluate((img) => (img as HTMLImageElement).naturalWidth)
          .catch(() => 0)
      )
      .toBeGreaterThan(0)
    await page.keyboard.press('Escape')
    expect(page.url()).toContain(`/admin/requests/${requestId}`)
  })

  test('merged requests show a failed live check, and live is final', async ({ page }) => {
    const supabase = getAdminClient()
    const { data: admin } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', 'admin@stbasilsboston.org')
      .single()
    const title = `CI live request ${Date.now()}-${Math.round(Math.random() * 1000)}`
    const { data: row, error } = await supabase
      .from('change_requests')
      .insert({
        requester_id: admin!.id,
        title,
        description: 'Please update the giving page heading.',
        page_path: '/giving',
        status: 'merged',
        pr_number: 9997,
        pr_url: 'https://github.com/georgenijo/St-Basils-Rebuild/pull/9997',
        merge_commit_sha: 'cd'.repeat(20),
        merged_at: new Date().toISOString(),
        live_check_failed_at: new Date().toISOString(),
        error:
          'no successful Vercel production deployment of merge commit cdcdcdc appeared within 30 minutes. Check Vercel.',
      })
      .select('id')
      .single()
    expect(error).toBeNull()
    const requestId = row!.id as string
    createdIds.push(requestId)

    await loginAsSeedAdmin(page)
    await page.waitForURL('**/admin/**')
    await page.goto(`/admin/requests/${requestId}`, { waitUntil: 'domcontentloaded' })
    const status = page.getByTestId('change-request-status')
    const statusCard = page.getByRole('region', { name: 'Request status' })
    await expect(status).toContainText('Merged')
    await expect(statusCard).toContainText('no successful Vercel production deployment')

    // merged may only become live, and live is final.
    const { error: reopen } = await supabase
      .from('change_requests')
      .update({ status: 'needs_attention' })
      .eq('id', requestId)
    expect(reopen?.message).toContain('is merged')
    const { error: toLive } = await supabase
      .from('change_requests')
      .update({ status: 'live', live_at: new Date().toISOString(), error: null })
      .eq('id', requestId)
    expect(toLive).toBeNull()
    const { error: fromLive } = await supabase
      .from('change_requests')
      .update({ status: 'merged' })
      .eq('id', requestId)
    expect(fromLive?.message).toContain('is live')

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(status).toContainText('Live')
    await expect(statusCard).toContainText('The change is live on stbasilsboston.org.')
    await expect(statusCard).not.toContainText('no successful Vercel production deployment')
  })
})
