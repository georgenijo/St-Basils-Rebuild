import type { Verdict } from './types'

export interface ParsedVerdict {
  verdict: Verdict
  summary: string
}

const VERDICTS: Verdict[] = ['pass', 'fail', 'unsure']

function candidates(text: string): string[] {
  const out: string[] = []
  const fence = /```(?:json)?\s*([\s\S]*?)```/gi
  for (let m = fence.exec(text); m; m = fence.exec(text)) out.push(m[1])
  // Every balanced {...} span, outermost first.
  for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
    let depth = 0
    let inString = false
    for (let i = start; i < text.length; i++) {
      const ch = text[i]
      if (inString) {
        if (ch === '\\') i++
        else if (ch === '"') inString = false
      } else if (ch === '"') inString = true
      else if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) {
          out.push(text.slice(start, i + 1))
          break
        }
      }
    }
  }
  return out
}

/**
 * Parse the judge's reply. Anything that is not a well-formed verdict becomes
 * `unsure` so a confused judge can never mark a change as passing.
 */
export function parseVerdict(text: string): ParsedVerdict {
  const trimmed = text.trim()
  for (const candidate of [trimmed, ...candidates(trimmed)]) {
    try {
      const parsed = JSON.parse(candidate.trim()) as unknown
      if (!parsed || typeof parsed !== 'object') continue
      const record = parsed as Record<string, unknown>
      const verdict = typeof record.verdict === 'string' ? record.verdict.trim().toLowerCase() : ''
      if (!VERDICTS.includes(verdict as Verdict)) continue
      const summary =
        typeof record.summary === 'string' && record.summary.trim()
          ? record.summary.trim().slice(0, 2000)
          : 'No summary provided.'
      return { verdict: verdict as Verdict, summary }
    } catch {
      // try the next candidate
    }
  }
  return {
    verdict: 'unsure',
    summary: `Could not parse the verification verdict. Raw reply: ${trimmed.slice(0, 500) || '(empty)'}`,
  }
}
