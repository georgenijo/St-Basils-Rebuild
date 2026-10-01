import { expect, test } from '@playwright/test'

import { getAdminClient, loginAsSeedAdmin } from '../helpers/test-support'

// The request page polls every few seconds while a request is active; give
// each step a few poll intervals to show up.
const LIVE_TIMEOUT = 20_000

test.describe('CI admin website request live status', () => {
  let requestId: string | null = null

  test.afterAll(async () => {
    if (requestId) await getAdminClient().from('change_requests').delete().eq('id', requestId)
  })

  test('the request page follows the agent through each step without a reload', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const supabase = getAdminClient()
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers()
    expect(usersError).toBeNull()
    const admin = users.users.find((user) => user.email === 'admin@stbasilsboston.org')
    expect(admin).toBeTruthy()

    const title = `CI live status ${Date.now()}-${Math.round(Math.random() * 1000)}`
    const { data: created, error: insertError } = await supabase
      .from('change_requests')
      .insert({
        requester_id: admin!.id,
        title,
        description: 'Update the welcome heading on the home page.',
        page_path: '/',
        status: 'queued',
      })
      .select('id')
      .single()
    expect(insertError).toBeNull()
    requestId = created!.id as string
    const update = async (patch: Record<string, unknown>) => {
      const { error } = await supabase.from('change_requests').update(patch).eq('id', requestId!)
      expect(error).toBeNull()
    }

    await loginAsSeedAdmin(page)
    await page.waitForURL('**/admin/**')
    await page.goto(`/admin/requests/${requestId}`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible()

    const live = page.getByTestId('change-request-live-status')
    const step = page.getByTestId('change-request-step')
    const currentStep = live.locator('[aria-current="step"]')
    await expect(step).toHaveText('Waiting for the website agent')
    await expect(currentStep).toHaveText('Queued')
    await expect(page.getByTestId('change-request-step-elapsed')).toContainText('Waiting for')
    await expect(live).toContainText('Live — updates automatically')

    // Detects a reload: the marker only survives client-side refreshes.
    await page.evaluate(() => {
      ;(window as unknown as { __liveMarker: boolean }).__liveMarker = true
    })

    await update({
      status: 'in_progress',
      claimed_by: 'ci-worker',
      claimed_at: new Date().toISOString(),
      attempts: 1,
    })
    await expect(step).toHaveText('Editing the website', { timeout: LIVE_TIMEOUT })
    await expect(currentStep).toHaveText('Editing')
    await expect(page.getByTestId('change-request-status')).toContainText('In progress')
    await expect(live).toContainText('Agent working for')

    // New thread messages appear without a status change.
    const { error: messageError } = await supabase.from('change_request_messages').insert({
      request_id: requestId,
      author_kind: 'system',
      body: 'The worker picked up this request and is preparing a change.',
    })
    expect(messageError).toBeNull()
    await expect(page.getByText('The worker picked up this request')).toBeVisible({
      timeout: LIVE_TIMEOUT,
    })

    await update({
      status: 'verifying',
      branch_name: 'change-request/ci-live',
      pr_number: 4242,
      pr_url: 'https://github.com/georgenijo/St-Basils-Rebuild/pull/4242',
    })
    await expect(step).toHaveText('Waiting for CI checks and the preview site', {
      timeout: LIVE_TIMEOUT,
    })
    await expect(currentStep).toHaveText('CI checks & preview')
    await expect(page.getByRole('link', { name: /^View PR #4242/ })).toBeVisible()

    await update({ preview_url: 'https://ci-live-preview.vercel.app' })
    await expect(step).toHaveText('Checking the preview in a browser', { timeout: LIVE_TIMEOUT })
    await expect(currentStep).toHaveText('Browser check')

    // Finished: the badge updates and the live panel goes away.
    await update({
      status: 'ready_for_review',
      verification: { verdict: 'pass', summary: 'Heading updated.', checks: [], commit_sha: null },
    })
    await expect(page.getByTestId('change-request-status')).toContainText('Ready for review', {
      timeout: LIVE_TIMEOUT,
    })
    await expect(live).toHaveCount(0)

    // The worker posts its closing message just after the final status; the
    // page keeps watching briefly so it still shows up.
    const { error: closingError } = await supabase.from('change_request_messages').insert({
      request_id: requestId,
      author_kind: 'system',
      body: 'Preview verified (pass): Heading updated.',
    })
    expect(closingError).toBeNull()
    await expect(page.getByText('Preview verified (pass): Heading updated.')).toBeVisible({
      timeout: LIVE_TIMEOUT,
    })

    expect(
      await page.evaluate(() => (window as unknown as { __liveMarker?: boolean }).__liveMarker)
    ).toBe(true)
  })
})
