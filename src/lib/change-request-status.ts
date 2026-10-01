import type { ChangeRequestStatus, ChangeRequestVerdict } from '@/types/change-request'

export type StatusTone = 'ok' | 'warn' | 'neutral'

interface StatusInfo {
  label: string
  description: string
  tone: StatusTone
}

export const CHANGE_REQUEST_STATUS_INFO: Record<ChangeRequestStatus, StatusInfo> = {
  submitting: {
    label: 'Submitting…',
    description:
      'Still being submitted while attachments are saved. If this does not change within a minute, the submission did not finish; submit it again. The unfinished request is removed automatically later.',
    tone: 'neutral',
  },
  queued: {
    label: 'Queued',
    description: 'Submitted and waiting for the website agent to pick it up.',
    tone: 'neutral',
  },
  in_progress: {
    label: 'In progress',
    description: 'The website agent is making the change on a separate branch.',
    tone: 'neutral',
  },
  verifying: {
    label: 'Verifying',
    description:
      'A pull request is open. The agent is waiting for the preview site and checking the change in a real browser.',
    tone: 'neutral',
  },
  ready_for_review: {
    label: 'Ready for review',
    description:
      'The change is on a preview site and passed its checks. Nothing is live until the pull request is merged. To have the agent revise it, choose "Request changes" below.',
    tone: 'ok',
  },
  needs_attention: {
    label: 'Needs attention',
    description:
      'The agent stopped and needs a person. Read the latest messages below; replying sends the request back to the queue.',
    tone: 'warn',
  },
  merging: {
    label: 'Merging…',
    description:
      'An admin approved this change and it is being merged on GitHub. If GitHub did not confirm the merge, the agent checks and records the outcome.',
    tone: 'neutral',
  },
  merged: {
    label: 'Merged',
    description:
      'The pull request was merged. Vercel deploys it to stbasilsboston.org in a few minutes, and the agent confirms here when the change is live.',
    tone: 'ok',
  },
  live: {
    label: 'Live',
    description: 'The change is live on stbasilsboston.org.',
    tone: 'ok',
  },
  closed: {
    label: 'Closed',
    description:
      'The request was closed without merging, so nothing changed on the live site. It will not be worked on again.',
    tone: 'neutral',
  },
}

/** Statuses where the worker is actively moving the request forward. */
export const ACTIVE_CHANGE_REQUEST_STATUSES: readonly ChangeRequestStatus[] = [
  'submitting',
  'queued',
  'in_progress',
  'verifying',
  'merging',
]

/** Statuses an admin can close: no worker is running on them (see close_change_request). */
export const CLOSABLE_CHANGE_REQUEST_STATUSES: readonly ChangeRequestStatus[] = [
  'queued',
  'ready_for_review',
  'needs_attention',
]

export function isClosableChangeRequestStatus(status: string): boolean {
  return (CLOSABLE_CHANGE_REQUEST_STATUSES as readonly string[]).includes(status)
}

/** How long the page keeps refreshing after a live check outcome lands. */
const LIVE_OUTCOME_SETTLE_MS = 60_000

/**
 * Merged and not yet confirmed live or reported, or the outcome landed within
 * the last minute. The request and thread are separate reads, so one more
 * refresh guarantees the outcome's thread entry shows up too.
 */
export function isAwaitingLiveCheck(
  request: { status: string; live_at?: string | null; live_check_failed_at?: string | null },
  now = Date.now()
): boolean {
  if (request.status === 'merged' && !request.live_check_failed_at) return true
  const settledAt =
    request.live_check_failed_at ?? (request.status === 'live' ? request.live_at : null)
  return Boolean(settledAt) && now - Date.parse(settledAt as string) < LIVE_OUTCOME_SETTLE_MS
}

export function isActiveChangeRequestStatus(status: string): boolean {
  return (ACTIVE_CHANGE_REQUEST_STATUSES as readonly string[]).includes(status)
}

export function getChangeRequestStatusInfo(status: string): StatusInfo {
  return (
    CHANGE_REQUEST_STATUS_INFO[status as ChangeRequestStatus] ?? {
      label: status,
      description: '',
      tone: 'neutral',
    }
  )
}

export const VERDICT_INFO: Record<ChangeRequestVerdict, { label: string; tone: StatusTone }> = {
  pass: { label: 'Passed', tone: 'ok' },
  fail: { label: 'Failed', tone: 'warn' },
  unsure: { label: 'Unsure', tone: 'neutral' },
}

export interface VerificationCheck {
  name: string
  outcome: 'pass' | 'fail' | 'unknown'
  detail: string | null
}

function stringField(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function outcomeOf(record: Record<string, unknown>): VerificationCheck['outcome'] {
  for (const key of ['passed', 'ok', 'pass', 'success']) {
    if (typeof record[key] === 'boolean') return record[key] ? 'pass' : 'fail'
  }
  const text = stringField(record, ['status', 'result', 'verdict', 'outcome'])?.toLowerCase()
  if (text && ['pass', 'passed', 'ok', 'success'].includes(text)) return 'pass'
  if (text && ['fail', 'failed', 'error'].includes(text)) return 'fail'
  return 'unknown'
}

/**
 * The worker owns the `checks` shape; accept arrays of strings or objects with
 * common name/outcome/detail keys, or an object keyed by check name.
 */
export function normalizeVerificationChecks(checks: unknown): VerificationCheck[] {
  const entries: [string | null, unknown][] = Array.isArray(checks)
    ? checks.map((value) => [null, value])
    : checks && typeof checks === 'object'
      ? Object.entries(checks as Record<string, unknown>)
      : []

  return entries.flatMap(([key, value]): VerificationCheck[] => {
    if (typeof value === 'string') {
      return [{ name: key ?? value, outcome: 'unknown', detail: key ? value : null }]
    }
    if (typeof value === 'boolean') {
      return key ? [{ name: key, outcome: value ? 'pass' : 'fail', detail: null }] : []
    }
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>
      const name =
        stringField(record, ['name', 'label', 'title', 'check', 'description']) ?? key ?? 'Check'
      return [
        {
          name,
          outcome: outcomeOf(record),
          detail: stringField(record, ['detail', 'details', 'notes', 'message', 'reason']),
        },
      ]
    }
    return []
  })
}

/** Only render worker-supplied links that are plain http(s) URLs. */
export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

/**
 * Resolve a site path against `base` and return the URL only if it stays on
 * the base's origin. Guards against protocol-relative (`//evil.example`) and
 * other paths that would escape the site.
 */
export function sameOriginUrl(path: string, base: string): string | null {
  try {
    const baseUrl = new URL(base)
    const url = new URL(path, baseUrl)
    return url.origin === baseUrl.origin ? url.toString() : null
  } catch {
    return null
  }
}

/** Short form of a verified commit SHA, or null if it doesn't look like one. */
export function shortCommitSha(value: unknown): string | null {
  return typeof value === 'string' && /^[0-9a-f]{7,40}$/i.test(value) ? value.slice(0, 7) : null
}

// ─── Live progress ──────────────────────────────────────────────────────

export type ChangeRequestStepKey = 'queued' | 'editing' | 'checks' | 'browser' | 'review'

/** The stages a request moves through while the website agent works on it. */
export const CHANGE_REQUEST_STEPS: readonly { key: ChangeRequestStepKey; label: string }[] = [
  { key: 'queued', label: 'Queued' },
  { key: 'editing', label: 'Editing' },
  { key: 'checks', label: 'CI checks & preview' },
  { key: 'browser', label: 'Browser check' },
  { key: 'review', label: 'Ready for review' },
]

export interface ChangeRequestStep {
  key: ChangeRequestStepKey
  /** What is happening right now, in plain words. */
  label: string
  /** When the current step started (ISO). */
  since: string
  /** When the agent started this attempt (ISO), once it has been claimed. */
  startedAt: string | null
}

type StepFields = {
  status: string
  preview_url: string | null
  claimed_at: string | null
  created_at: string
  updated_at: string
}

/**
 * The current step of an active request, derived from the columns the worker
 * already writes: claiming sets `in_progress` + `claimed_at` (and a CI repair
 * round goes back to `in_progress`); opening or updating the PR sets
 * `verifying` and clears `preview_url`; the preview being ready sets
 * `preview_url`. Each of those writes bumps `updated_at`, which is therefore
 * when the step began. Returns null once the request is no longer active.
 */
export function getChangeRequestStep(request: StepFields): ChangeRequestStep | null {
  const startedAt = request.claimed_at
  switch (request.status) {
    case 'submitting':
      return {
        key: 'queued',
        label: 'Saving attachments',
        since: request.created_at,
        startedAt: null,
      }
    case 'queued':
      return {
        key: 'queued',
        label: 'Waiting for the website agent',
        since: request.updated_at,
        startedAt: null,
      }
    case 'in_progress':
      // Claiming, and the CI repair round, both set in_progress.
      return {
        key: 'editing',
        label: 'Editing the website',
        since: request.updated_at,
        startedAt,
      }
    case 'verifying':
      return request.preview_url
        ? {
            key: 'browser',
            label: 'Checking the preview in a browser',
            since: request.updated_at,
            startedAt,
          }
        : {
            key: 'checks',
            label: 'Waiting for CI checks and the preview site',
            since: request.updated_at,
            startedAt,
          }
    default:
      return null
  }
}

/** "less than a minute", "4 min", "1 hr 5 min". */
export function formatElapsed(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000)
  if (minutes < 1) return 'less than a minute'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`
}
