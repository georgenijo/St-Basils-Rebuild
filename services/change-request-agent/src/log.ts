type Level = 'debug' | 'info' | 'warn' | 'error'

let redactions: string[] = []

/** Register secret values that must be masked in every log line. */
export function registerRedactions(values: string[]): void {
  redactions = values.filter((value) => value.length >= 8)
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
