import { existsSync } from 'node:fs'
import path from 'node:path'

import type { Config } from './config'
import { childEnv, run } from './exec'
import { log } from './log'

const FORMATTABLE = /\.(tsx?|jsx?|mjs|cjs|css|json|md|mdx|html|ya?ml)$/i

/**
 * The only check the worker still runs locally: a trusted, deterministic
 * formatting pass (never rejects, unlike lint/typecheck which need the full
 * dependency graph and can disagree with what actually runs in CI). Lint,
 * typecheck and build now run in CI against the exact pushed commit (see
 * ci-status.ts and job.ts's waitForCi) instead of a second local copy of
 * the same checks — this keeps the worker's own scratch environment out of
 * the loop for anything that already has a dedicated CI job.
 */
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
  // A prettier syntax error is reported again (more usefully) by CI's lint/typecheck.
  if (res.code !== 0)
    log.warn('prettier reported errors', { output: (res.stderr || res.stdout).slice(-2000) })
}
