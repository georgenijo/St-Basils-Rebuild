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
  merged: {
    label: 'Merged',
    description: 'The pull request was merged. The change goes live with the next deployment.',
    tone: 'ok',
  },
  closed: {
    label: 'Closed',
    description: 'The pull request was closed without merging. Nothing changed on the site.',
    tone: 'neutral',
  },
}

/** Statuses where the worker is actively moving the request forward. */
export const ACTIVE_CHANGE_REQUEST_STATUSES: readonly ChangeRequestStatus[] = [
  'submitting',
  'queued',
  'in_progress',
  'verifying',
]

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
