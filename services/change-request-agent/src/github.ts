import { secretValues, type Config } from './config'
import { run } from './exec'
import { log } from './log'
import type { DeploymentStatus, DeploymentWithStatuses } from './preview'
import { redactPublic, truncate } from './redact'

const API = 'https://api.github.com'
const GRAPHQL_API = 'https://api.github.com/graphql'

/** GITHUB_TOKEN, or locally the token of the logged-in gh CLI. */
export async function resolveGithubToken(config: Config): Promise<string | null> {
  if (config.githubToken) return config.githubToken
  try {
    const res = await run('gh', ['auth', 'token'], { env: process.env, timeoutMs: 10_000 })
    const token = res.code === 0 ? res.stdout.trim() : ''
    if (token) {
      log.info('using GitHub token from gh auth token')
      return token
    }
  } catch {
    // gh not installed
  }
  return null
}

export class GitHub {
  private token: string | null
  private secrets: string[]

  /**
   * @param secrets worker secrets; every outbound title/body/comment is passed
   *   through redactPublic (secrets, tokens, emails, phone numbers) because the
   *   repository is public.
   */
  constructor(
    private readonly repo: string,
    token: string | null,
    secrets: string[] = []
  ) {
    this.token = token
    this.secrets = secrets
  }

  /**
   * Apply a refreshed GITHUB_TOKEN mid-run (long single-repo runs, see
   * credential-refresh.ts). The old token keeps being redacted (log.ts's
   * `addRedactions` is additive and this appends to the local scrub list too);
   * only the new token is used for subsequent requests.
   */
  setToken(token: string | null): void {
    this.token = token
    if (token && !this.secrets.includes(token)) this.secrets = [...this.secrets, token]
  }

  private scrub(text: string, max: number): string {
    return truncate(redactPublic(text, this.secrets), max)
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'st-basils-change-request-agent',
    }
    if (this.token) headers.Authorization = `Bearer ${this.token}`
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    const res = await fetch(`${API}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    })
    const text = await res.text()
    if (!res.ok) {
      throw new Error(`GitHub ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`)
    }
    return (text ? JSON.parse(text) : null) as T
  }

  /**
   * GitHub's GraphQL v4 API. Used only where REST has no equivalent field —
   * today that is exactly `markPullRequestReadyForReview` (see
   * `markReadyForReview` below): the REST "Update a pull request" endpoint
   * does not accept a `draft` field, so there is no way to flip draft→ready
   * over REST (this matches `gh pr ready`, which uses this same mutation).
   */
  private async graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'st-basils-change-request-agent',
      'Content-Type': 'application/json',
    }
    if (this.token) headers.Authorization = `Bearer ${this.token}`
    const res = await fetch(GRAPHQL_API, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(30_000),
    })
    const text = await res.text()
    if (!res.ok) {
      throw new Error(`GitHub GraphQL → ${res.status}: ${text.slice(0, 300)}`)
    }
    const parsed = (text ? JSON.parse(text) : {}) as { data?: T; errors?: unknown[] }
    if (parsed.errors && parsed.errors.length > 0) {
      throw new Error(`GitHub GraphQL errors: ${JSON.stringify(parsed.errors).slice(0, 300)}`)
    }
    return parsed.data as T
  }

  /** Like `request`, but returns the raw response body text instead of parsing JSON. */
  private async requestText(method: string, path: string): Promise<string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'st-basils-change-request-agent',
    }
    if (this.token) headers.Authorization = `Bearer ${this.token}`
    const res = await fetch(`${API}${path}`, {
      method,
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000),
    })
    const text = await res.text()
    if (!res.ok) {
      throw new Error(`GitHub ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`)
    }
    return text
  }

  private get owner(): string {
    return this.repo.split('/')[0]
  }

  async findOpenPullForBranch(
    branch: string
  ): Promise<{ number: number; html_url: string } | null> {
    const pulls = await this.request<{ number: number; html_url: string }[]>(
      'GET',
      `/repos/${this.repo}/pulls?state=open&head=${encodeURIComponent(`${this.owner}:${branch}`)}`
    )
    return pulls[0] ?? null
  }

  /** Newest PR for the branch in any state (open, closed or merged), if any. */
  async findLatestPullForBranch(branch: string): Promise<{ number: number } | null> {
    const pulls = await this.request<{ number: number }[]>(
      'GET',
      `/repos/${this.repo}/pulls?state=all&sort=created&direction=desc&per_page=1&head=${encodeURIComponent(`${this.owner}:${branch}`)}`
    )
    return pulls[0] ?? null
  }

  /** Remove stale readiness before editing or pushing another revision. */
  async markDraftForBranch(branch: string): Promise<void> {
    const existing = await this.findOpenPullForBranch(branch)
    if (!existing) return
    const pr = await this.request<{ node_id: string; draft: boolean }>(
      'GET',
      `/repos/${this.repo}/pulls/${existing.number}`
    )
    if (pr.draft) return
    await this.graphql(
      `mutation($id: ID!) {
        convertPullRequestToDraft(input: { pullRequestId: $id }) {
          pullRequest { id isDraft }
        }
      }`,
      { id: pr.node_id }
    )
  }

  /**
   * Open as draft, or update a PR already re-drafted at pipeline admission.
   * With `existingNumber` (the PR recorded on the request) only that PR is
   * updated: if it is no longer open this throws instead of opening a
   * replacement, so closing a PR on GitHub is never undone by the worker.
   */
  async openOrUpdatePull(input: {
    branch: string
    base: string
    title: string
    body: string
    existingNumber?: number | null
  }): Promise<{ number: number; html_url: string; created: boolean }> {
    if (input.existingNumber) {
      const pr = await this.request<{ number: number; html_url: string; state: string }>(
        'GET',
        `/repos/${this.repo}/pulls/${input.existingNumber}`
      )
      if (pr.state !== 'open') {
        throw new Error(`Pull request #${input.existingNumber} is no longer open`)
      }
      await this.request('PATCH', `/repos/${this.repo}/pulls/${pr.number}`, {
        title: this.scrub(input.title, 100),
        body: this.scrub(input.body, 60_000),
      })
      return { number: pr.number, html_url: pr.html_url, created: false }
    }
    const existing = await this.findOpenPullForBranch(input.branch)
    if (existing) {
      await this.request('PATCH', `/repos/${this.repo}/pulls/${existing.number}`, {
        title: this.scrub(input.title, 100),
        body: this.scrub(input.body, 60_000),
      })
      return { ...existing, created: false }
    }
    const pr = await this.request<{ number: number; html_url: string }>(
      'POST',
      `/repos/${this.repo}/pulls`,
      {
        title: this.scrub(input.title, 100),
        body: this.scrub(input.body, 60_000),
        head: input.branch,
        base: input.base,
        draft: true,
      }
    )
    return { ...pr, created: true }
  }

  /**
   * Convert a draft PR to "ready for review". Only called after CI and the
   * preview/verification steps all succeed (see job.ts); a job that fails
   * any of those simply never calls this, so the PR stays draft for a human
   * to look at — no separate "close/reopen" or status field needed. REST's
   * "Update a pull request" endpoint has no `draft` field, so this goes
   * through GraphQL's `markPullRequestReadyForReview` (same mechanism
   * `gh pr ready` uses). A no-op if the PR is already not a draft.
   */
  async markReadyForReview(prNumber: number): Promise<void> {
    const pr = await this.request<{ node_id: string; draft: boolean }>(
      'GET',
      `/repos/${this.repo}/pulls/${prNumber}`
    )
    if (!pr.draft) return
    await this.graphql(
      `mutation($id: ID!) {
        markPullRequestReadyForReview(input: { pullRequestId: $id }) {
          pullRequest { id isDraft }
        }
      }`,
      { id: pr.node_id }
    )
  }

  async closePull(prNumber: number): Promise<void> {
    await this.request('PATCH', `/repos/${this.repo}/pulls/${prNumber}`, { state: 'closed' })
  }

  /** Delete a branch; false if it was already gone. */
  async deleteBranch(branch: string): Promise<boolean> {
    try {
      await this.request(
        'DELETE',
        `/repos/${this.repo}/git/refs/heads/${branch.split('/').map(encodeURIComponent).join('/')}`
      )
      return true
    } catch (error) {
      // Only a confirmed missing ref means there is nothing left to delete;
      // any other failure (including other 422s) is retried next sweep.
      const text = String(error)
      if (/→ 404:/.test(text) || /→ 422:[\s\S]*Reference does not exist/.test(text)) return false
      throw error
    }
  }

  async comment(prNumber: number, body: string): Promise<void> {
    await this.request('POST', `/repos/${this.repo}/issues/${prNumber}/comments`, {
      body: this.scrub(body, 60_000),
    })
  }

  async pullState(prNumber: number): Promise<{
    state: 'open' | 'closed'
    merged: boolean
    mergeCommitSha: string | null
    headSha: string | null
    mergedAt: string | null
  }> {
    const pr = await this.request<{
      state: 'open' | 'closed'
      merged: boolean
      merged_at: string | null
      merge_commit_sha: string | null
      head?: { sha: string }
    }>('GET', `/repos/${this.repo}/pulls/${prNumber}`)
    const merged = pr.merged || Boolean(pr.merged_at)
    return {
      state: pr.state,
      merged,
      mergeCommitSha: merged ? pr.merge_commit_sha : null,
      headSha: pr.head?.sha ?? null,
      mergedAt: pr.merged_at,
    }
  }

  async deploymentsForSha(sha: string): Promise<DeploymentWithStatuses[]> {
    return this.deploymentsWithStatuses(`sha=${sha}&per_page=20`)
  }

  /** One page of production deployments (any commit), newest first. */
  async latestProductionDeployments(page = 1, perPage = 10): Promise<DeploymentWithStatuses[]> {
    return this.deploymentsWithStatuses(`environment=Production&per_page=${perPage}&page=${page}`)
  }

  /** Whether `head` contains `base` (GitHub compare: ahead or identical). */
  async commitContains(head: string, base: string): Promise<boolean> {
    const result = await this.request<{ status: string }>(
      'GET',
      `/repos/${this.repo}/compare/${base}...${head}`
    )
    return result.status === 'ahead' || result.status === 'identical'
  }

  private async deploymentsWithStatuses(query: string): Promise<DeploymentWithStatuses[]> {
    const deployments = await this.request<Omit<DeploymentWithStatuses, 'statuses'>[]>(
      'GET',
      `/repos/${this.repo}/deployments?${query}`
    )
    return Promise.all(
      deployments.map(async (d) => ({
        id: d.id,
        sha: d.sha,
        environment: d.environment,
        created_at: d.created_at,
        statuses: await this.request<DeploymentStatus[]>(
          'GET',
          `/repos/${this.repo}/deployments/${d.id}/statuses?per_page=10`
        ),
      }))
    )
  }

  /** Check runs reported against the exact commit SHA that was pushed and opened as a PR. */
  async checkRunsForSha(sha: string): Promise<GithubCheckRun[]> {
    const page = await this.request<{ check_runs: GithubCheckRun[] }>(
      'GET',
      `/repos/${this.repo}/commits/${sha}/check-runs?per_page=100`
    )
    return page.check_runs
  }

  /**
   * Plain-text job log for a failed run, used to build a repair prompt. The
   * Actions API redirects this endpoint to short-lived blob storage; `fetch`
   * follows the redirect automatically. GitHub Actions creates one check-run
   * per job with the check-run id equal to the job id, so a failing check
   * run's `id` can be passed straight through here.
   */
  async jobLog(jobId: number): Promise<string> {
    return this.requestText('GET', `/repos/${this.repo}/actions/jobs/${jobId}/logs`)
  }
}

export interface GithubCheckRun {
  id: number
  name: string
  status: 'queued' | 'in_progress' | 'completed'
  conclusion:
    | 'success'
    | 'failure'
    | 'neutral'
    | 'cancelled'
    | 'skipped'
    | 'timed_out'
    | 'action_required'
    | 'stale'
    | null
  html_url: string | null
}

/** The worker's GitHub client: every outbound text is redacted with the configured secrets. */
export function createGitHub(config: Config): GitHub {
  return new GitHub(config.githubRepo, config.githubToken, secretValues(config))
}
