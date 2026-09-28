import type { Verdict } from './types'

export interface ParsedVerdict {
  verdict: Verdict
  summary: string
}

const VERDICTS: Verdict[] = ['pass', 'fail', 'unsure']

function unsure(reason: string, raw: string): ParsedVerdict {
  return {
    verdict: 'unsure',
    summary: `Could not use the verification verdict (${reason}). Raw reply: ${raw.slice(0, 500) || '(empty)'}`,
  }
}

/**
 * Parse the judge's reply strictly: exactly one JSON object with exactly the
 * keys `verdict` (pass|fail|unsure) and `summary` (non-empty string),
 * optionally wrapped in a single outer code fence and nothing else. Prose,
 * several objects, or anything malformed becomes `unsure`, so an example
 * object can never be mistaken for the real verdict.
 */
export function parseVerdict(text: string): ParsedVerdict {
  const raw = text.trim()
  let body = raw
  const fenced = /^```[a-zA-Z]*[ \t]*\n([\s\S]*?)\n?```$/.exec(raw)
  if (fenced) body = fenced[1].trim()
  if (!body.startsWith('{') || !body.endsWith('}')) return unsure('not a single JSON object', raw)

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return unsure('invalid JSON', raw)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return unsure('not a JSON object', raw)
  }
  const record = parsed as Record<string, unknown>
  const keys = Object.keys(record).sort()
  if (keys.length !== 2 || keys[0] !== 'summary' || keys[1] !== 'verdict') {
    return unsure('unexpected fields', raw)
  }
  if (typeof record.verdict !== 'string' || !VERDICTS.includes(record.verdict as Verdict)) {
    return unsure('invalid verdict', raw)
  }
  if (typeof record.summary !== 'string' || !record.summary.trim()) {
    return unsure('missing summary', raw)
  }
  return { verdict: record.verdict as Verdict, summary: record.summary.trim().slice(0, 2000) }
}
