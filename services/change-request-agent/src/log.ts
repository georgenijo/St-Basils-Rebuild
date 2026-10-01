type Level = 'debug' | 'info' | 'warn' | 'error'

let redactions: string[] = []

/** Register secret values that must be masked in every log line (replaces the set). */
export function registerRedactions(values: string[]): void {
  redactions = values.filter((value) => value.length >= 8)
}

/**
 * Add secret values to the redaction set without dropping ones already
 * registered (e.g. a refreshed GITHUB_TOKEN: the previous token may still be
 * referenced by in-flight log lines or retries, so it must keep being masked
 * alongside the new one).
 */
export function addRedactions(values: string[]): void {
  const additions = values.filter((value) => value.length >= 8 && !redactions.includes(value))
  if (additions.length) redactions = [...redactions, ...additions]
}

export function redact(text: string): string {
  let out = text
  for (const value of redactions) out = out.split(value).join('[redacted]')
  return out
}

function write(level: Level, msg: string, fields: Record<string, unknown> = {}): void {
  const normalized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields)) {
    normalized[key] =
      value instanceof Error ? { message: value.message, stack: value.stack } : value
  }
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...normalized })
  process.stdout.write(`${redact(line)}\n`)
}

export const log = {
  debug: (msg: string, fields?: Record<string, unknown>) => {
    if (process.env.LOG_LEVEL === 'debug') write('debug', msg, fields)
  },
  info: (msg: string, fields?: Record<string, unknown>) => write('info', msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => write('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => write('error', msg, fields),
}
