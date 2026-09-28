import { SECRET_PATTERNS } from './guardrails'

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g
// North American numbers (617-555-0123, (617) 555 0123, +1 617.555.0123) and
// international numbers written with a leading +. Word/dash boundaries keep
// UUIDs, SHAs and dates intact.
const PHONE_NANP = /(?<![\w.-])(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?![\w-])/g
const PHONE_INTL = /(?<![\w.-])\+\d[\d\s().-]{7,}\d(?![\w-])/g

export const REDACTED = '[redacted]'

/**
 * Scrub text leaving the private system for the public GitHub repository
 * (PR title/body/comments, commit messages, branch names): worker secrets,
 * secret-shaped tokens, email addresses and phone numbers.
 */
export function redactPublic(text: string, secrets: string[] = []): string {
  let out = text
  for (const secret of secrets) {
    if (secret.length >= 8) out = out.split(secret).join(REDACTED)
  }
  for (const pattern of SECRET_PATTERNS) out = out.replace(pattern, REDACTED)
  return out.replace(EMAIL, REDACTED).replace(PHONE_INTL, REDACTED).replace(PHONE_NANP, REDACTED)
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`
}

/** Public PR title: redacted, single line, at most 100 characters. */
export function prTitle(title: string, secrets: string[] = []): string {
  return truncate(redactPublic(`Change request: ${title.replace(/[\r\n]+/g, ' ')}`, secrets), 100)
}
