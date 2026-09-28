import { existsSync } from 'node:fs'
import path from 'node:path'

import type { Config } from './config'
import { childEnv, run } from './exec'
import { log } from './log'

const FORMATTABLE = /\.(tsx?|jsx?|mjs|cjs|css|json|md|mdx|html|ya?ml)$/i

export async function formatFiles(config: Config, files: string[]): Promise<void> {
  const targets = files.filter(
    (file) => FORMATTABLE.test(file) && existsSync(path.join(config.workDir, file))
  )
  if (targets.length === 0) return
  const res = await run(
    path.join(config.workDir, 'node_modules', '.bin', 'prettier'),
    ['--write', '--ignore-unknown', '--log-level', 'warn', '--', ...targets],
    { cwd: config.workDir, env: childEnv(), timeoutMs: config.checkTimeoutMs }
  )
  // A prettier syntax error is reported again (more usefully) by lint/typecheck.
  if (res.code !== 0)
    log.warn('prettier reported errors', { output: (res.stderr || res.stdout).slice(-2000) })
}

export interface CheckResult {
  ok: boolean
  /** Combined failure output (empty when ok). */
  output: string
  ran: string[]
}

export async function runChecks(config: Config): Promise<CheckResult> {
  const failures: string[] = []
  const ran: string[] = []
  for (const script of ['lint', 'typecheck']) {
    const started = Date.now()
    const res = await run('npm', ['run', '--silent', script], {
      cwd: config.workDir,
      env: childEnv({ CI: '1' }),
      timeoutMs: config.checkTimeoutMs,
    })
    ran.push(script)
    const ok = res.code === 0 && !res.timedOut
    log.info('check finished', { script, ok, durationMs: Date.now() - started })
    if (!ok) {
      const body = `${res.stdout}\n${res.stderr}`.trim()
      failures.push(
        `$ npm run ${script}${res.timedOut ? ' (timed out)' : ''}\n${body.slice(-8000)}`
      )
    }
  }
  return { ok: failures.length === 0, output: failures.join('\n\n'), ran }
}
