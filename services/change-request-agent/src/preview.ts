export interface DeploymentStatus {
  state: string
  environment_url?: string | null
  target_url?: string | null
  created_at: string
}

export interface DeploymentWithStatuses {
  id: number
  sha: string
  environment: string
  created_at: string
  statuses: DeploymentStatus[]
}

export type PreviewSelection =
  | { state: 'ready'; url: string; deploymentId: number }
  | { state: 'failed'; detail: string }
  | { state: 'pending' }

function isPreviewEnvironment(environment: string): boolean {
  return /^preview\b/i.test(environment.trim())
}

function latest<T extends { created_at: string }>(items: T[]): T | undefined {
  return [...items].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0]
}

/**
 * Pick the Vercel preview for `sha` from GitHub deployments. The newest
 * matching deployment decides: its latest status `success` → ready,
 * `failure`/`error` → failed, anything else → still pending.
 */
export function selectPreviewDeployment(
  deployments: DeploymentWithStatuses[],
  sha: string
): PreviewSelection {
  const matching = deployments.filter((d) => d.sha === sha && isPreviewEnvironment(d.environment))
  const newest = latest(matching)
  if (!newest) return { state: 'pending' }
  const status = latest(newest.statuses)
  if (!status) return { state: 'pending' }
  if (status.state === 'success') {
    const url = status.environment_url || status.target_url
    if (url && /^https:\/\//.test(url)) {
      return { state: 'ready', url: url.replace(/\/+$/, ''), deploymentId: newest.id }
    }
    return { state: 'pending' }
  }
  if (status.state === 'failure' || status.state === 'error') {
    return { state: 'failed', detail: `Vercel preview deployment ${status.state}` }
  }
  return { state: 'pending' }
}
