// Website-request navigation benchmark: list → request detail → back to list,
// measured in a real browser against a LOCAL Supabase stack (never production).
//
// Usage:
//   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/bench/bench-request-pages.mjs <baseURL> <label> [iterations]
//
// Seeds one request with a thread, two full-page screenshots and an image
// attachment, logs in as the seed admin, then for each iteration records:
//   feedback  click → first visible response (route skeleton or the page itself)
//   header    click → request title (h1) visible
//   thread    click → conversation messages visible
//   shots     click → every screenshot tile decoded
//   back      "Back to Requests" click → list row visible
// plus the image bytes the detail page downloads. Run the Next.js app with
// NEXT_PUBLIC_SUPABASE_URL behind scripts/bench/latency-proxy.mjs to model
// hosted-Supabase round trips.
import { writeFileSync } from 'fs'
import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const [baseURL, label, itersArg] = process.argv.slice(2)
if (!baseURL || !label) {
  console.error('usage: bench-request-pages.mjs <baseURL> <label> [iterations]')
  process.exit(1)
}
const ITERATIONS = Number(itersArg || 10)
const supabaseUrl = process.env.SUPABASE_URL
if (!supabaseUrl || !/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(supabaseUrl)) {
  console.error('SUPABASE_URL must point at a local Supabase stack')
  process.exit(1)
}
const admin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function screenshot(hue) {
  // Noisy full-page screenshot so PNG compression resembles a real page.
  const width = 1280
  const height = 4200
  const raw = Buffer.alloc(width * height * 3)
  for (let i = 0; i < raw.length; i += 3) {
    const noise = (i * 2654435761) >>> 24
    raw[i] = (hue + noise) & 0xff
    raw[i + 1] = (200 + (noise >> 2)) & 0xff
    raw[i + 2] = (180 + (noise >> 1)) & 0xff
  }
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer()
}

async function seed() {
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', 'admin@stbasilsboston.org')
    .single()
  const title = `Bench request ${Date.now()}`
  const { data: request, error } = await admin
    .from('change_requests')
    .insert({
      requester_id: profile.id,
      title,
      description: 'Please update the footer wording and the Sunday service times.',
      page_path: '/',
      status: 'ready_for_review',
      pr_number: 999,
      pr_url: 'https://github.com/georgenijo/St-Basils-Rebuild/pull/999',
      preview_url: 'https://example.vercel.app',
      verification: { verdict: 'pass', summary: 'Footer updated.', commit_sha: 'abcdef1234567' },
    })
    .select('id')
    .single()
  if (error) throw error

  const messages = [
    ['requester', profile.id, 'Please change the footer text.'],
    ['system', null, 'Queued for the website agent.'],
    ['agent', null, 'Opened pull request #999.'],
    ['agent', null, 'CI passed. Preview verified.'],
    ['requester', profile.id, 'Looks good, thanks!'],
  ]
  for (const [author_kind, author_id, body] of messages) {
    await admin
      .from('change_request_messages')
      .insert({ request_id: request.id, author_kind, author_id, body })
  }

  const files = [
    ['verification', 'before.png', 'Before', await screenshot(10)],
    ['verification', 'after.png', 'After', await screenshot(90)],
    ['attachment', 'flyer.png', null, await screenshot(160)],
  ]
  for (const [kind, filename, fileLabel, bytes] of files) {
    const storage_path = `requests/${request.id}/${kind}/${filename}`
    await admin.storage
      .from('change-requests')
      .upload(storage_path, bytes, { contentType: 'image/png', upsert: true })
    await admin.from('change_request_files').insert({
      request_id: request.id,
      kind,
      storage_path,
      filename,
      content_type: 'image/png',
      size_bytes: bytes.length,
      label: fileLabel,
    })
  }
  return { id: request.id, title, paths: files.map(([k, f]) => `requests/${request.id}/${k}/${f}`) }
}

async function cleanup({ id, paths }) {
  await admin.storage.from('change-requests').remove(paths)
  await admin.from('change_requests').delete().eq('id', id)
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? Math.round(s[Math.floor(s.length / 2)]) : null
}

const fixture = await seed()
// CHROMIUM_PATH: optional browser binary when Playwright's bundled one is unavailable.
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const results = []
try {
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()
  await page.goto('/login')
  await page.locator('input#email').fill('admin@stbasilsboston.org')
  await page.locator('input#password').fill('admin123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/admin/**')
  await page.goto('/admin/requests')
  const rowLink = page.getByRole('link', { name: fixture.title })
  await rowLink.waitFor()

  for (let i = 0; i < ITERATIONS; i++) {
    let imageBytes = 0
    const onResponse = async (response) => {
      if (response.request().resourceType() !== 'image') return
      const body = await response.body().catch(() => null)
      if (body) imageBytes += body.byteLength
    }
    page.on('response', onResponse)
    // Let Link prefetches settle, as a real admin would scan the list first.
    await page.waitForTimeout(500)

    const t0 = Date.now()
    await rowLink.click()
    await page
      .locator(
        `[data-testid="change-request-loading"], h1:text-is(${JSON.stringify(fixture.title)})`
      )
      .first()
      .waitFor()
    const feedback = Date.now() - t0
    await page.getByRole('heading', { level: 1, name: fixture.title }).waitFor()
    const header = Date.now() - t0
    await page.locator('.cr-thread .cr-message').first().waitFor()
    const thread = Date.now() - t0
    await page.waitForFunction(() => {
      const imgs = [...document.querySelectorAll('.cr-shots img')]
      return imgs.length >= 2 && imgs.every((img) => img.complete && img.naturalWidth > 0)
    })
    const shots = Date.now() - t0
    await page.waitForTimeout(300)
    page.off('response', onResponse)

    const t1 = Date.now()
    await page.getByRole('link', { name: 'Back to Requests' }).click()
    await rowLink.waitFor()
    const back = Date.now() - t1

    results.push({ feedback, header, thread, shots, back, imageKB: Math.round(imageBytes / 1024) })
    console.log(label, i, JSON.stringify(results.at(-1)))
  }
} finally {
  await browser.close()
  await cleanup(fixture)
}

const summary = Object.fromEntries(
  Object.keys(results[0]).map((key) => [key, median(results.map((r) => r[key]))])
)
console.log(`${label} median`, JSON.stringify(summary))
writeFileSync(
  `/tmp/bench-request-pages-${label}.json`,
  JSON.stringify({ results, summary }, null, 2)
)
