import { spawn } from 'node:child_process'

export interface ExecOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
  input?: string
  timeoutMs?: number
  /** Cap on captured stdout/stderr (bytes each). */
  maxOutput?: number
}

export interface ExecResult {
  code: number | null
  stdout: string
  stderr: string
  timedOut: boolean
}

export class ExecError extends Error {
  constructor(
    message: string,
    readonly result: ExecResult
  ) {
    super(message)
  }
}

const SAFE_ENV_KEYS = [
  'PATH',
  'HOME',
  'USER',
  'LANG',
  'LC_ALL',
  'TERM',
  'TMPDIR',
  'SHELL',
  'NODE_OPTIONS',
  'npm_config_cache',
  'PLAYWRIGHT_BROWSERS_PATH',
  'XDG_CACHE_HOME',
  'XDG_CONFIG_HOME',
  'CI',
]

/**
 * Minimal environment for child processes that run repository code (npm,
 * eslint, tsc, prettier). Worker secrets (Supabase service key, GitHub token,
 * Resend key) are never passed through.
 */
export function childEnv(extra: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  const out: Record<string, string | undefined> = {}
  for (const key of SAFE_ENV_KEYS) {
    if (process.env[key] !== undefined) out[key] = process.env[key]
  }
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined) out[key] = value
  }
  out.NEXT_TELEMETRY_DISABLED = '1'
  return out as NodeJS.ProcessEnv
}

const activeChildren = new Set<number>()

/** Kill every running child process group (used on SIGTERM). */
export function killAllChildren(): void {
  for (const pid of activeChildren) {
    try {
      process.kill(-pid, 'SIGKILL')
    } catch {
      // already gone
    }
  }
  activeChildren.clear()
}

export function run(
  command: string,
  args: string[],
  options: ExecOptions = {}
): Promise<ExecResult> {
  const maxOutput = options.maxOutput ?? 2_000_000
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? childEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true,
    })
    const pid = child.pid
    if (pid) activeChildren.add(pid)
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timer =
      options.timeoutMs !== undefined
        ? setTimeout(() => {
            timedOut = true
            try {
              // Kill the whole process group (npm/eslint spawn children).
              if (child.pid) process.kill(-child.pid, 'SIGKILL')
            } catch {
              child.kill('SIGKILL')
            }
          }, options.timeoutMs)
        : null
    child.stdout.on('data', (chunk: Buffer) => {
      if (stdout.length < maxOutput) stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < maxOutput) stderr += chunk.toString('utf8')
    })
    child.on('error', (error) => {
      if (timer) clearTimeout(timer)
      if (pid) activeChildren.delete(pid)
      reject(error)
    })
    child.on('close', (code) => {
      if (timer) clearTimeout(timer)
      if (pid) activeChildren.delete(pid)
      resolve({ code, stdout, stderr, timedOut })
    })
    child.stdin.on('error', () => {})
    if (options.input !== undefined) child.stdin.end(options.input)
    else child.stdin.end()
  })
}

/** Run and throw ExecError on non-zero exit or timeout. */
export async function runChecked(
  command: string,
  args: string[],
  options: ExecOptions = {}
): Promise<ExecResult> {
  const result = await run(command, args, options)
  if (result.timedOut) {
    throw new ExecError(`${command} ${args[0] ?? ''} timed out`, result)
  }
  if (result.code !== 0) {
    const tail = (result.stderr || result.stdout).trim().split('\n').slice(-20).join('\n')
    throw new ExecError(`${command} ${args.join(' ')} exited with ${result.code}: ${tail}`, result)
  }
  return result
}
