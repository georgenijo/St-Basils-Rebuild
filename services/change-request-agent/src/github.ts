import type { Config } from './config'
import { run } from './exec'
import { log } from './log'
import type { DeploymentStatus, DeploymentWithStatuses } from './preview'

const API = 'https://api.github.com'

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
  constructor(
    private readonly repo: string,
    private readonly token: string | null
  ) {}

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

  async openOrUpdatePull(input: {
    branch: string
    base: string
    title: string
    body: string
  }): Promise<{ number: number; html_url: string; created: boolean }> {
    const existing = await this.findOpenPullForBranch(input.branch)
    if (existing) {
      await this.request('PATCH', `/repos/${this.repo}/pulls/${existing.number}`, {
        title: input.title,
        body: input.body,
      })
      return { ...existing, created: false }
    }
    const pr = await this.request<{ number: number; html_url: string }>(
      'POST',
      `/repos/${this.repo}/pulls`,
      { title: input.title, body: input.body, head: input.branch, base: input.base }
    )
    return { ...pr, created: true }
  }

  async comment(prNumber: number, body: string): Promise<void> {
    await this.request('POST', `/repos/${this.repo}/issues/${prNumber}/comments`, { body })
  }

  async pullState(prNumber: number): Promise<{ state: 'open' | 'closed'; merged: boolean }> {
    const pr = await this.request<{
      state: 'open' | 'closed'
      merged: boolean
      merged_at: string | null
    }>('GET', `/repos/${this.repo}/pulls/${prNumber}`)
    return { state: pr.state, merged: pr.merged || Boolean(pr.merged_at) }
  }

  async deploymentsForSha(sha: string): Promise<DeploymentWithStatuses[]> {
    const deployments = await this.request<Omit<DeploymentWithStatuses, 'statuses'>[]>(
      'GET',
      `/repos/${this.repo}/deployments?sha=${sha}&per_page=20`
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
}
