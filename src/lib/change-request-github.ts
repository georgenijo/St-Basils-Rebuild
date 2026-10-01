import 'server-only'

import { logger } from '@/lib/logger'

// Site-side GitHub access for "Approve & merge" (#359). Optional: without
// CHANGE_REQUEST_GITHUB_TOKEN the button is hidden and the action refuses.
// The token is a fine-grained personal access token limited to this one
// repository (Pull requests: read & write, Contents: read & write, Checks:
// read). See docs/change-requests.md ("Approving and merging").

const API = 'https://api.github.com'
const DEFAULT_REPO = 'georgenijo/St-Basils-Rebuild'
const log = logger.child({ scope: 'change-request-github' })

/** The always-on PR jobs in .github/workflows/ci.yml (same set the worker gates on). */
export const REQUIRED_CHANGE_REQUEST_CHECKS = [
  'Validate',
  'Unit Tests',
  'Change Request Agent Service',
  'Browser Flow Tests',
] as const

const FULL_SHA = /^[0-9a-f]{40}$/

interface GithubConfig {
  token: string
  repo: string
  /** The production branch: Vercel deploys merges into it to the live site. */
  base: string
}

function githubConfig(): GithubConfig | null {
  const token = process.env.CHANGE_REQUEST_GITHUB_TOKEN?.trim()
  if (!token) return null
  const repo = process.env.CHANGE_REQUEST_GITHUB_REPO?.trim() || DEFAULT_REPO
  return { token, repo, base: 'main' }
}

export function isChangeRequestMergeConfigured(): boolean {
  return githubConfig() !== null
}

async function github<T>(
  config: GithubConfig,
  method: 'GET' | 'PUT',
  path: string,
  body?: unknown
): Promise<{ status: number; data: T | null }> {
  const response = await fetch(`${API}/repos/${config.repo}${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${config.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'st-basils-website',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  })
  const text = await response.text()
  let data: T | null = null
  try {
    data = text ? (JSON.parse(text) as T) : null
  } catch {
    data = null
  }
  return { status: response.status, data }
}

interface PullResponse {
  state: 'open' | 'closed'
  merged: boolean
  draft: boolean
  mergeable: boolean | null
  head: { sha: string }
  base: { ref: string }
}

interface CheckRun {
  id: number
  name: string
  status: string
  conclusion: string | null
}

export type MergeReadiness = { ok: true } | { ok: false; reason: string; retryable?: boolean }

/** The newest run of each required check on `sha` must have succeeded. */
export function requiredChecksPassed(
  runs: CheckRun[]
): { ok: true } | { ok: false; reason: string } {
  for (const name of REQUIRED_CHANGE_REQUEST_CHECKS) {
    const matching = runs.filter((run) => run.name === name)
    if (matching.length === 0) return { ok: false, reason: `The "${name}" check has not run yet.` }
    const newest = matching.reduce((a, b) => (b.id > a.id ? b : a))
    if (newest.status !== 'completed') {
      return { ok: false, reason: `The "${name}" check is still running.` }
    }
    if (newest.conclusion !== 'success') {
      return { ok: false, reason: `The "${name}" check did not pass.` }
    }
  }
  return { ok: true }
}

/**
 * Whether the request's PR can be merged right now: open, not a draft, its
 * head is exactly the commit the agent verified, GitHub sees no conflict,
 * and every required check passed on that commit.
 */
export async function checkMergeReadiness(input: {
  prNumber: number
  verifiedSha: string | null | undefined
}): Promise<MergeReadiness> {
  const config = githubConfig()
  if (!config) return { ok: false, reason: 'Merging from the website is not set up.' }
  if (!input.verifiedSha || !FULL_SHA.test(input.verifiedSha)) {
    return { ok: false, reason: 'There is no verified commit to merge.' }
  }
  try {
    const pull = await github<PullResponse>(config, 'GET', `/pulls/${input.prNumber}`)
    if (pull.status !== 200 || !pull.data) {
      return { ok: false, reason: 'Could not read the pull request from GitHub.', retryable: true }
    }
    if (pull.data.merged) return { ok: false, reason: 'The pull request is already merged.' }
    if (pull.data.state !== 'open') return { ok: false, reason: 'The pull request is closed.' }
    if (pull.data.draft) return { ok: false, reason: 'The pull request is a draft.' }
    if (pull.data.base?.ref !== config.base) {
      return { ok: false, reason: `The pull request does not target ${config.base}.` }
    }
    if (pull.data.head.sha !== input.verifiedSha) {
      return {
        ok: false,
        reason:
          'The pull request has changed since it was verified. Wait for the agent to verify it again.',
      }
    }
    if (pull.data.mergeable === false) {
      return { ok: false, reason: 'The pull request has merge conflicts with the live site.' }
    }
    if (pull.data.mergeable === null) {
      return {
        ok: false,
        reason: 'GitHub is still checking whether it can be merged. Try again in a minute.',
        retryable: true,
      }
    }
    const checks = await github<{ check_runs: CheckRun[] }>(
      config,
      'GET',
      `/commits/${input.verifiedSha}/check-runs?per_page=100`
    )
    if (checks.status !== 200 || !checks.data) {
      return { ok: false, reason: 'Could not read the checks from GitHub.', retryable: true }
    }
    return requiredChecksPassed(checks.data.check_runs)
  } catch (error) {
    log.warn('change_request.merge_readiness_failed', { error, prNumber: input.prNumber })
    return { ok: false, reason: 'Could not reach GitHub.', retryable: true }
  }
}

export type MergeResult =
  | { ok: true; mergeCommitSha: string }
  /** `uncertain`: GitHub may have merged it (timeout, 5xx); never treat as refused. */
  | { ok: false; reason: string; uncertain?: boolean }

/**
 * Squash-merge only if the head is still exactly `sha` (GitHub rejects the
 * merge with 409 otherwise), so a revision pushed after the readiness check
 * can never be merged unverified.
 */
export async function mergeChangeRequestPull(prNumber: number, sha: string): Promise<MergeResult> {
  const config = githubConfig()
  if (!config) return { ok: false, reason: 'Merging from the website is not set up.' }
  try {
    const result = await github<{ merged?: boolean; sha?: string; message?: string }>(
      config,
      'PUT',
      `/pulls/${prNumber}/merge`,
      { sha, merge_method: 'squash' }
    )
    if (result.status === 200 && result.data?.merged && result.data.sha) {
      return { ok: true, mergeCommitSha: result.data.sha }
    }
    log.warn('change_request.merge_rejected', { prNumber, status: result.status })
    if (result.status === 409) {
      return { ok: false, reason: 'The pull request changed since it was verified.' }
    }
    if (result.status === 405) {
      return { ok: false, reason: 'GitHub says the pull request cannot be merged right now.' }
    }
    if (result.status >= 500 || result.status === 200) {
      return { ok: false, reason: 'GitHub did not confirm the merge.', uncertain: true }
    }
    return { ok: false, reason: 'GitHub did not merge the pull request.' }
  } catch (error) {
    log.warn('change_request.merge_failed', { error, prNumber })
    return { ok: false, reason: 'GitHub did not confirm the merge.', uncertain: true }
  }
}
