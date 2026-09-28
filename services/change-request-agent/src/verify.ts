import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { chromium, devices, type Browser, type Page } from 'playwright'

import { READ_TOOLS, runClaude } from './claude'
import type { Config } from './config'
import { uploadVerificationShot, type Db } from './db'
import { log } from './log'
import { labelSlug } from './naming'
import { buildVerifyPrompt } from './prompt'
import type {
  ChangeRequest,
  ChangeRequestMessage,
  VerificationCheck,
  VerificationResult,
} from './types'
import { parseVerdict } from './verdict'

const MAX_SHOT_HEIGHT = 3000
const PADDING = 32

interface ViewportSpec {
  name: 'desktop' | 'mobile'
  options: Parameters<Browser['newContext']>[0]
}

const VIEWPORTS: ViewportSpec[] = [
  { name: 'desktop', options: { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 } },
  { name: 'mobile', options: { ...devices['Pixel 5'] } },
]

export interface Shot {
  label: string
  file: string
  png: Buffer
}

interface PageCapture {
  status: number | null
  errors: string[]
  targetFound: boolean
  targetVisible: boolean
  /** outerHTML of the picked element (truncated), for non-visual changes like alt text. */
  targetHtml: string | null
  png: Buffer
}

export function joinUrl(base: string, pagePath: string): string {
  return `${base.replace(/\/+$/, '')}${pagePath.startsWith('/') ? pagePath : `/${pagePath}`}`
}

async function screenshotAround(
  page: Page,
  selector: string | null
): Promise<Omit<PageCapture, 'status' | 'errors' | 'targetHtml'>> {
  const viewport = page.viewportSize() ?? { width: 1280, height: 900 }
  if (selector) {
    try {
      const target = page.locator(selector).first()
      if ((await target.count()) > 0) {
        const visible = await target.isVisible()
        if (visible) {
          await target.scrollIntoViewIfNeeded({ timeout: 5_000 })
          await page.waitForTimeout(500)
          const box = await target.boundingBox()
          if (box && box.width > 0 && box.height > 0) {
            const scroll = await page.evaluate(() => ({
              x: window.scrollX,
              y: window.scrollY,
              w: document.documentElement.scrollWidth,
              h: document.documentElement.scrollHeight,
            }))
            const x = Math.max(0, box.x + scroll.x - PADDING)
            const y = Math.max(0, box.y + scroll.y - PADDING)
            const width = Math.min(scroll.w - x, box.width + PADDING * 2)
            const height = Math.min(scroll.h - y, box.height + PADDING * 2, MAX_SHOT_HEIGHT)
            // Tiny elements: show the surrounding viewport instead so the reviewer has context.
            const clip =
              width < 200 || height < 120
                ? {
                    x: 0,
                    y: Math.max(0, box.y + scroll.y - viewport.height / 3),
                    width: viewport.width,
                    height: viewport.height,
                  }
                : { x, y, width, height }
            // Scroll back to the top (the element's lazy content has loaded) so
            // fixed/sticky headers render at the top of the full-page capture
            // instead of on top of the clipped element.
            await page.evaluate(() => window.scrollTo(0, 0))
            await page.waitForTimeout(300)
            const png = await page.screenshot({ fullPage: true, clip })
            return { targetFound: true, targetVisible: true, png }
          }
        }
        return { targetFound: true, targetVisible: false, png: await fullPageCapped(page) }
      }
    } catch (error) {
      log.warn('target selector failed', { selector, error })
    }
    return { targetFound: false, targetVisible: false, png: await fullPageCapped(page) }
  }
  return { targetFound: false, targetVisible: false, png: await fullPageCapped(page) }
}

async function fullPageCapped(page: Page): Promise<Buffer> {
  const viewport = page.viewportSize() ?? { width: 1280, height: 900 }
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  await page.evaluate(() => window.scrollTo(0, 0))
  return page.screenshot({
    fullPage: true,
    clip: { x: 0, y: 0, width: viewport.width, height: Math.min(height, MAX_SHOT_HEIGHT) },
  })
}

async function capture(
  browser: Browser,
  spec: ViewportSpec,
  url: string,
  selector: string | null,
  headers: Record<string, string>
): Promise<PageCapture> {
  const context = await browser.newContext({
    ...spec.options,
    reducedMotion: 'reduce',
    extraHTTPHeaders: headers,
  })
  try {
    const page = await context.newPage()
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message.slice(0, 300)))
    const response = await page.goto(url, { waitUntil: 'load', timeout: 60_000 })
    const status = response?.status() ?? null
    // Media, analytics and video can keep the network busy forever; network
    // idle is best-effort on top of the load event.
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {
      log.debug('networkidle not reached; continuing after load', { url })
    })
    await page.waitForTimeout(1_000)
    let targetHtml: string | null = null
    if (selector) {
      targetHtml = await page
        .locator(selector)
        .first()
        .evaluate((el) => el.outerHTML.slice(0, 1500), undefined, { timeout: 3_000 })
        .catch(() => null)
    }
    const shot = await screenshotAround(page, selector)
    return { status, errors, targetHtml, ...shot }
  } finally {
    await context.close()
  }
}

export interface CaptureResult {
  shots: Shot[]
  checks: VerificationCheck[]
  /** Desktop outerHTML of the picked element before/after (null when not found). */
  targetHtml: { before: string | null; after: string | null } | null
}

export async function captureComparison(input: {
  baselineUrl: string
  previewUrl: string
  pagePath: string
  selector: string | null
  bypassSecret: string | null
}): Promise<CaptureResult> {
  const browser = await chromium.launch()
  const shots: Shot[] = []
  const checks: VerificationCheck[] = []
  let targetHtml: CaptureResult['targetHtml'] = null
  const previewHeaders: Record<string, string> = input.bypassSecret
    ? { 'x-vercel-protection-bypass': input.bypassSecret, 'x-vercel-set-bypass-cookie': 'true' }
    : {}
  try {
    for (const spec of VIEWPORTS) {
      const before = await capture(
        browser,
        spec,
        joinUrl(input.baselineUrl, input.pagePath),
        input.selector,
        {}
      )
      const after = await capture(
        browser,
        spec,
        joinUrl(input.previewUrl, input.pagePath),
        input.selector,
        previewHeaders
      )
      shots.push({
        label: `before · ${spec.name}`,
        file: `before-${spec.name}.png`,
        png: before.png,
      })
      shots.push({ label: `after · ${spec.name}`, file: `after-${spec.name}.png`, png: after.png })
      if (input.selector && spec.name === 'desktop') {
        targetHtml = { before: before.targetHtml, after: after.targetHtml }
      }

      checks.push({
        name: `preview responds (${spec.name})`,
        ok: after.status !== null && after.status < 400,
        detail: `HTTP ${after.status ?? 'no response'}`,
      })
      const newErrors = after.errors.filter((e) => !before.errors.includes(e))
      checks.push({
        name: `no new uncaught page errors (${spec.name})`,
        ok: newErrors.length === 0,
        detail: newErrors.length ? newErrors.slice(0, 3).join(' | ') : undefined,
      })
      if (input.selector) {
        checks.push({
          name: `picked element visible on preview (${spec.name}, advisory)`,
          ok: after.targetVisible,
          detail: after.targetVisible
            ? undefined
            : before.targetFound
              ? 'Element no longer matches the picked selector on the preview; the change may have intentionally replaced or removed it.'
              : 'Selector did not match on production either; showing the top of the page.',
        })
      }
    }
  } finally {
    await browser.close()
  }
  return { shots, checks, targetHtml }
}

/** Hard checks gate `ready_for_review`; advisory ones only inform the judge. */
export function hardChecksPass(checks: VerificationCheck[]): boolean {
  return checks.filter((c) => !c.name.includes('advisory')).every((c) => c.ok)
}

export async function judge(
  config: Config,
  input: {
    request: ChangeRequest
    messages: ChangeRequestMessage[]
    agentSummary: string
    shots: Shot[]
    checks: VerificationCheck[]
    targetHtml: CaptureResult['targetHtml']
  }
): Promise<{ verdict: VerificationResult['verdict']; summary: string }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cr-verify-'))
  try {
    for (const shot of input.shots) await fs.writeFile(path.join(dir, shot.file), shot.png)
    const prompt = buildVerifyPrompt({
      request: input.request,
      messages: input.messages,
      agentSummary: input.agentSummary,
      screenshots: input.shots.map((s) => ({ label: s.label, file: s.file })),
      checks: input.checks,
      targetHtml: input.targetHtml,
    })
    const res = await runClaude(config, {
      cwd: dir,
      prompt,
      tools: READ_TOOLS,
      label: 'verify',
      timeoutMs: 10 * 60_000,
    })
    return parseVerdict(res.result)
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

export async function uploadShots(db: Db, requestId: string, shots: Shot[]): Promise<void> {
  for (const shot of shots) {
    const slug = labelSlug(shot.label)
    await uploadVerificationShot(
      db,
      requestId,
      `requests/${requestId}/verification/${slug}.png`,
      `${slug}.png`,
      shot.label,
      shot.png
    )
  }
}

export interface VerifyInput {
  config: Config
  db: Db
  request: ChangeRequest
  messages: ChangeRequestMessage[]
  agentSummary: string
  previewUrl: string
}

/** Screenshots + checks + upload + judge. Returns the verification record. */
export async function verifyPreview(input: VerifyInput): Promise<VerificationResult> {
  const { config, request } = input
  const { shots, checks, targetHtml } = await captureComparison({
    baselineUrl: config.baselineUrl,
    previewUrl: input.previewUrl,
    pagePath: request.page_path,
    selector: request.target_selector,
    bypassSecret: config.vercelBypassSecret,
  })
  await uploadShots(input.db, request.id, shots)
  log.info('verification screenshots uploaded', { requestId: request.id, count: shots.length })
  let verdict: { verdict: VerificationResult['verdict']; summary: string }
  try {
    verdict = await judge(config, { ...input, shots, checks, targetHtml })
  } catch (error) {
    verdict = {
      verdict: 'unsure',
      summary: `The visual review could not run: ${(error as Error).message.slice(0, 300)}`,
    }
  }
  return { verdict: verdict.verdict, summary: verdict.summary, checks }
}
