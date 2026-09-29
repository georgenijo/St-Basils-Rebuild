import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { chromium, devices, type Browser, type BrowserContext, type Page } from 'playwright'

import { READ_TOOLS, runClaude } from './claude'
import type { Config } from './config'
import { uploadVerificationShot, type Db } from './db'
import { log } from './log'
import { labelSlug } from './naming'
import { validatePreviewUrl } from './preview'
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
/** Context captured above and below the picked element, as a share of viewport height. */
const CONTEXT_RATIO = 0.4

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
  /** Finalized .webm path, only set when `recordDir` was passed to `capture`. */
  videoPath: string | null
}

export function joinUrl(base: string, pagePath: string): string {
  return `${base.replace(/\/+$/, '')}${pagePath.startsWith('/') ? pagePath : `/${pagePath}`}`
}

async function screenshotAround(
  page: Page,
  selector: string | null
): Promise<Omit<PageCapture, 'status' | 'errors' | 'targetHtml' | 'videoPath'>> {
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
            // Requests often change something next to the picked element (a
            // caption under a flyer), so capture the full page width plus
            // generous context above and below instead of the element alone.
            const context = Math.max(PADDING, Math.round(viewport.height * CONTEXT_RATIO))
            const y = Math.max(0, box.y + scroll.y - context)
            const clip = {
              x: 0,
              y,
              width: Math.min(scroll.w, viewport.width),
              height: Math.min(scroll.h - y, box.height + context * 2, MAX_SHOT_HEIGHT),
            }
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
  bypass: { origin: string; secret: string } | null,
  /** When set, records this capture to a private .webm under this directory. */
  recordDir: string | null = null
): Promise<PageCapture> {
  // No extraHTTPHeaders: they would be sent to every third-party origin the
  // page loads. The bypass secret goes to the preview origin only.
  const context = await browser.newContext({
    ...spec.options,
    reducedMotion: 'reduce',
    ...(recordDir ? { recordVideo: { dir: recordDir } } : {}),
  })
  try {
    if (bypass) await setVercelBypassCookie(context, bypass.origin, bypass.secret)
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
    // The video file is only finalized once the context (owning the page) closes.
    const video = page.video()
    await context.close()
    const videoPath = video ? await video.path().catch(() => null) : null
    return { status, errors, targetHtml, ...shot, videoPath }
  } catch (error) {
    await context.close().catch(() => {})
    throw error
  }
}

/**
 * One request to the preview origin (sharing the context's cookie jar) so
 * Vercel sets its host-scoped bypass cookie. The secret-bearing URL and any
 * error text that could contain it are never logged or rethrown.
 */
async function setVercelBypassCookie(
  context: BrowserContext,
  origin: string,
  secret: string
): Promise<void> {
  const url = `${origin}/?x-vercel-protection-bypass=${encodeURIComponent(secret)}&x-vercel-set-bypass-cookie=true`
  let status: number
  try {
    const response = await context.request.get(url, { maxRedirects: 0, timeout: 30_000 })
    status = response.status()
    await response.dispose()
  } catch {
    throw new Error('Vercel protection bypass request to the preview failed')
  }
  if (status >= 400) throw new Error(`Vercel protection bypass request returned HTTP ${status}`)
}

export interface Recording {
  label: string
  file: string
  webm: Buffer
}

export interface CaptureResult {
  shots: Shot[]
  checks: VerificationCheck[]
  /** Desktop outerHTML of the picked element before/after (null when not found). */
  targetHtml: { before: string | null; after: string | null } | null
  /**
   * Screen recording of the desktop preview load, private evidence alongside
   * the screenshots (admin-only; never linked from the public PR). Null when
   * the desktop preview capture did not produce a readable video file.
   */
  recording: Recording | null
}

export async function captureComparison(input: {
  baselineUrl: string
  previewUrl: string
  pagePath: string
  selector: string | null
  bypassSecret: string | null
}): Promise<CaptureResult> {
  const previewOrigin = validatePreviewUrl(input.previewUrl)
  if (!previewOrigin) throw new Error('Preview URL is not an https *.vercel.app address')
  const browser = await chromium.launch()
  const shots: Shot[] = []
  const checks: VerificationCheck[] = []
  let targetHtml: CaptureResult['targetHtml'] = null
  let recording: Recording | null = null
  const bypass = input.bypassSecret ? { origin: previewOrigin, secret: input.bypassSecret } : null
  const videoDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cr-verify-video-'))
  try {
    for (const spec of VIEWPORTS) {
      const before = await capture(
        browser,
        spec,
        joinUrl(input.baselineUrl, input.pagePath),
        input.selector,
        null
      )
      // Only the desktop "after" load is recorded: it is the one screen the
      // admin needs a real walkthrough of, and recording every capture would
      // multiply verification time and private storage for no extra signal.
      const recordAfter = spec.name === 'desktop'
      const after = await capture(
        browser,
        spec,
        joinUrl(previewOrigin, input.pagePath),
        input.selector,
        bypass,
        recordAfter ? videoDir : null
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
      if (recordAfter && after.videoPath) {
        try {
          const webm = await fs.readFile(after.videoPath)
          recording = { label: 'after · desktop (recording)', file: 'after-desktop.webm', webm }
        } catch (error) {
          log.warn('preview recording could not be read; continuing without it', {
            error: String(error),
          })
        }
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
    await fs.rm(videoDir, { recursive: true, force: true })
  }
  return { shots, checks, targetHtml, recording }
}

/** Hard checks gate `ready_for_review`; advisory ones only inform the judge. */
export function hardChecksPass(checks: VerificationCheck[]): boolean {
  return checks.filter((c) => !c.name.includes('advisory')).every((c) => c.ok)
}

/**
 * The desktop screen recording is required private evidence, not a
 * best-effort extra: this is a non-advisory check specifically so
 * `hardChecksPass` (and therefore job.ts's `passed` / `markReadyForReview`
 * gate) fails whenever it is missing or failed to upload. `captureComparison`
 * already logs the underlying reason (video not produced, or unreadable);
 * this only decides pass/fail and carries a public-safe (no raw error text —
 * this check's `detail` reaches the public PR via buildVerdictComment)
 * summary of which case happened.
 */
export function evidenceCheck(
  recording: Recording | null,
  uploadFailed: boolean
): VerificationCheck {
  const ok = recording !== null && !uploadFailed
  return {
    name: 'private evidence recording captured (required)',
    ok,
    detail: ok
      ? undefined
      : recording === null
        ? 'The desktop preview pass was not recorded, or the recording could not be read; see the worker log.'
        : 'The screen recording was captured but could not be uploaded to private storage; see the worker log.',
  }
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

/** Private evidence; never referenced from the public PR (see prbody.ts). */
export async function uploadRecording(
  db: Db,
  requestId: string,
  recording: Recording
): Promise<void> {
  const slug = labelSlug(recording.label)
  await uploadVerificationShot(
    db,
    requestId,
    `requests/${requestId}/verification/${slug}.webm`,
    `${slug}.webm`,
    recording.label,
    recording.webm,
    'video/webm'
  )
}

export interface VerifyInput {
  config: Config
  db: Db
  request: ChangeRequest
  messages: ChangeRequestMessage[]
  agentSummary: string
  previewUrl: string
  /** Commit the preview deployment was built from (recorded in the verification). */
  commitSha: string | null
}

/** Screenshots + checks + upload + judge. Returns the verification record. */
export async function verifyPreview(input: VerifyInput): Promise<VerificationResult> {
  const { config, request } = input
  const { shots, checks, targetHtml, recording } = await captureComparison({
    baselineUrl: config.baselineUrl,
    previewUrl: input.previewUrl,
    pagePath: request.page_path,
    selector: request.target_selector,
    bypassSecret: config.vercelBypassSecret,
  })
  await uploadShots(input.db, request.id, shots)
  log.info('verification screenshots uploaded', { requestId: request.id, count: shots.length })
  let uploadFailed = false
  if (recording) {
    try {
      await uploadRecording(input.db, request.id, recording)
      log.info('verification recording uploaded', { requestId: request.id })
    } catch (error) {
      uploadFailed = true
      // This is required private evidence (see evidenceCheck below), so a
      // failure here does end up gating the verdict — but the raw error is
      // only ever logged, never stored or posted anywhere the public PR or
      // an admin-visible check `detail` can echo it.
      log.warn('verification recording upload failed; treating as missing required evidence', {
        error: String(error),
      })
    }
  } else {
    log.warn('no verification recording produced; treating as missing required evidence')
  }
  const allChecks = [...checks, evidenceCheck(recording, uploadFailed)]
  let verdict: { verdict: VerificationResult['verdict']; summary: string }
  try {
    verdict = await judge(config, { ...input, shots, checks: allChecks, targetHtml })
  } catch (error) {
    verdict = {
      verdict: 'unsure',
      summary: `The visual review could not run: ${(error as Error).message.slice(0, 300)}`,
    }
  }
  return {
    verdict: verdict.verdict,
    summary: verdict.summary,
    checks: allChecks,
    commit_sha: input.commitSha,
  }
}
