import { existsSync } from 'node:fs'

import type { Config } from './config'
import { childEnv, run } from './exec'
import { log } from './log'

export const EDIT_TOOLS = ['Read', 'Edit', 'Write', 'Glob', 'Grep']
export const READ_TOOLS = ['Read']
const DISALLOWED_TOOLS = [
  'Bash',
  'BashOutput',
  'KillShell',
  'PowerShell',
  'WebFetch',
  'WebSearch',
  'Task',
  'Agent',
  'NotebookEdit',
  'TodoWrite',
  'Skill',
  'SlashCommand',
]

/** Env passed to the Claude CLI: auth/gateway settings only, no worker secrets. */
function claudeEnv(): NodeJS.ProcessEnv {
  const passthrough: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (/^(ANTHROPIC_|CLAUDE_CODE_|CLAUDE_CONFIG_DIR$)/.test(key)) passthrough[key] = value
  }
  return childEnv({
    ...passthrough,
    DISABLE_AUTOUPDATER: '1',
    DISABLE_TELEMETRY: '1',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
  })
}

export function buildClaudeArgs(config: Config, tools: string[]): string[] {
  const args = [
    '-p',
    '--model',
    config.claudeModel,
    '--output-format',
    'json',
    // --restricted drops code-running tools, ignores user/project settings,
    // and confines file tools to the working directory.
    '--restricted',
    '--tools',
    tools.join(','),
    '--allowedTools',
    tools.join(','),
    '--disallowedTools',
    DISALLOWED_TOOLS.join(','),
    '--permission-mode',
    'acceptEdits',
    '--permission-prompts',
    'none',
    '--strict-mcp-config',
    '--no-session-persistence',
  ]
  // Settings-file auth (e.g. apiKeyHelper in a CLAUDE_CONFIG_DIR profile)
  // still applies under --restricted when passed explicitly.
  if (config.claudeSettingsFile && existsSync(config.claudeSettingsFile)) {
    args.push('--settings', config.claudeSettingsFile)
  }
  return args
}

export interface ClaudeRun {
  result: string
  isError: boolean
  costUsd: number | null
  numTurns: number | null
  permissionDenials: unknown[]
}

export class ClaudeError extends Error {}

export async function runClaude(
  config: Config,
  options: { cwd: string; prompt: string; tools: string[]; timeoutMs?: number; label: string }
): Promise<ClaudeRun> {
  const started = Date.now()
  const res = await run(config.claudeBin, buildClaudeArgs(config, options.tools), {
    cwd: options.cwd,
    env: claudeEnv(),
    input: options.prompt,
    timeoutMs: options.timeoutMs ?? config.claudeTimeoutMs,
  })
  if (res.timedOut) throw new ClaudeError(`Claude (${options.label}) timed out`)
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(res.stdout.trim()) as Record<string, unknown>
  } catch {
    const tail = (res.stderr || res.stdout).trim().slice(-800)
    throw new ClaudeError(
      `Claude (${options.label}) exited with ${res.code} and no JSON result: ${tail}`
    )
  }
  const run_: ClaudeRun = {
    result: typeof parsed.result === 'string' ? parsed.result : '',
    isError: parsed.is_error === true || res.code !== 0,
    costUsd: typeof parsed.total_cost_usd === 'number' ? parsed.total_cost_usd : null,
    numTurns: typeof parsed.num_turns === 'number' ? parsed.num_turns : null,
    permissionDenials: Array.isArray(parsed.permission_denials) ? parsed.permission_denials : [],
  }
  log.info('claude run finished', {
    label: options.label,
    durationMs: Date.now() - started,
    isError: run_.isError,
    terminalReason: parsed.terminal_reason,
    costUsd: run_.costUsd,
    numTurns: run_.numTurns,
    permissionDenials: run_.permissionDenials.length,
  })
  if (run_.isError) {
    throw new ClaudeError(
      `Claude (${options.label}) failed: ${String(parsed.terminal_reason ?? parsed.subtype ?? 'error')} ${run_.result.slice(0, 500)}`.trim()
    )
  }
  return run_
}
