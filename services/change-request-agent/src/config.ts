import os from 'node:os'
import path from 'node:path'

export interface Config {
  supabaseUrl: string
  supabaseServiceRoleKey: string
  workerId: string
  pollIntervalMs: number
  prSyncIntervalMs: number
  staleClaimMinutes: number
  orphanMinAgeMinutes: number
  maxAttempts: number

  githubRepo: string
  repoUrl: string
  baseBranch: string
  githubToken: string | null
  workDir: string

  claudeBin: string
  claudeModel: string
  claudeTimeoutMs: number
  claudeSettingsFile: string | null

  checkTimeoutMs: number
  npmCiTimeoutMs: number
  maxDiffLines: number

  gitName: string
  gitEmail: string

  previewTimeoutMs: number
  previewPollMs: number
  vercelBypassSecret: string | null
  baselineUrl: string

  siteUrl: string
  resendApiKey: string | null
  notifyEmail: string | null
  notifyFrom: string

  dryRun: boolean
}

function env(name: string): string | undefined {
  const value = process.env[name]
  return value === undefined || value.trim() === '' ? undefined : value.trim()
}

function required(name: string): string {
  const value = env(name)
  if (!value) throw new Error(`Missing required environment variable ${name}`)
  return value
}

function int(name: string, fallback: number): number {
  const raw = env(name)
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer`)
  }
  return parsed
}

function nonNegativeInt(name: string, fallback: number): number {
  const raw = env(name)
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Environment variable ${name} must be a non-negative integer`)
  }
  return parsed
}

function flag(name: string): boolean {
  const raw = env(name)?.toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

export function loadConfig(options: { requireSupabase?: boolean } = {}): Config {
  const requireSupabase = options.requireSupabase ?? true
  const githubRepo = env('GITHUB_REPO') ?? 'georgenijo/St-Basils-Rebuild'
  const configDir = env('CLAUDE_CONFIG_DIR')

  return {
    supabaseUrl: requireSupabase ? required('SUPABASE_URL') : (env('SUPABASE_URL') ?? ''),
    supabaseServiceRoleKey: requireSupabase
      ? required('SUPABASE_SERVICE_ROLE_KEY')
      : (env('SUPABASE_SERVICE_ROLE_KEY') ?? ''),
    workerId: env('WORKER_ID') ?? `change-request-agent@${os.hostname()}`,
    pollIntervalMs: int('POLL_INTERVAL_MS', 15_000),
    prSyncIntervalMs: int('PR_SYNC_INTERVAL_MS', 5 * 60_000),
    staleClaimMinutes: int('STALE_CLAIM_MINUTES', 90),
    orphanMinAgeMinutes: nonNegativeInt('ORPHAN_MIN_AGE_MINUTES', 30),
    maxAttempts: int('MAX_ATTEMPTS', 3),

    githubRepo,
    repoUrl: env('REPO_URL') ?? `https://github.com/${githubRepo}.git`,
    baseBranch: env('BASE_BRANCH') ?? 'main',
    githubToken: env('GITHUB_TOKEN') ?? null,
    workDir: path.resolve(env('WORK_DIR') ?? '/data/repo'),

    claudeBin: env('CLAUDE_BIN') ?? 'claude',
    claudeModel: env('CLAUDE_MODEL') ?? 'claude-opus-5-5',
    claudeTimeoutMs: int('CLAUDE_TIMEOUT_MS', 20 * 60_000),
    claudeSettingsFile:
      env('CLAUDE_SETTINGS_FILE') ?? (configDir ? path.join(configDir, 'settings.json') : null),

    checkTimeoutMs: int('CHECK_TIMEOUT_MS', 10 * 60_000),
    npmCiTimeoutMs: int('NPM_CI_TIMEOUT_MS', 15 * 60_000),
    maxDiffLines: int('MAX_DIFF_LINES', 800),

    gitName: env('CHANGE_REQUEST_GIT_NAME') ?? 'St. Basils Change Request Agent',
    gitEmail: env('CHANGE_REQUEST_GIT_EMAIL') ?? 'change-requests@stbasilsboston.org',

    previewTimeoutMs: int('PREVIEW_TIMEOUT_MS', 15 * 60_000),
    previewPollMs: int('PREVIEW_POLL_MS', 20_000),
    vercelBypassSecret: env('VERCEL_AUTOMATION_BYPASS_SECRET') ?? null,
    baselineUrl: (env('BASELINE_URL') ?? 'https://stbasilsboston.org').replace(/\/+$/, ''),

    siteUrl: (env('SITE_URL') ?? 'https://stbasilsboston.org').replace(/\/+$/, ''),
    resendApiKey: env('RESEND_API_KEY') ?? null,
    notifyEmail: env('CHANGE_REQUEST_NOTIFY_EMAIL') ?? null,
    notifyFrom:
      env('CHANGE_REQUEST_FROM_EMAIL') ?? "St. Basil's Church <noreply@stbasilsboston.org>",

    dryRun: flag('DRY_RUN'),
  }
}

/** Values that must never appear in a diff, log line, or PR body. */
export function secretValues(config: Config): string[] {
  const candidates = [
    config.supabaseServiceRoleKey,
    config.githubToken,
    config.resendApiKey,
    config.vercelBypassSecret,
    env('ANTHROPIC_API_KEY'),
    env('ANTHROPIC_AUTH_TOKEN'),
    env('CLAUDE_CODE_OAUTH_TOKEN'),
  ]
  return candidates.filter(
    (value): value is string => typeof value === 'string' && value.length >= 12
  )
}
