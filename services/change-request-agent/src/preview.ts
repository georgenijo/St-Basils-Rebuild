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
  | { state: 'ready'; url: string; deploymentId: number; sha: string }
  | { state: 'failed'; detail: string }
  | { state: 'pending' }

/**
 * Normalise a Vercel preview URL to its origin, or null when it is not an
 * https URL on a *.vercel.app host (no credentials, default port). Only such
 * origins are ever loaded as "after" or sent the protection-bypass secret.
 */
export function validatePreviewUrl(raw: string): string | null {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null
  if (url.username || url.password || url.port) return null
  const host = url.hostname.toLowerCase()
  if (!host.endsWith('.vercel.app') || host === '.vercel.app' || host.startsWith('.')) return null
  if (!/^[a-z0-9.-]+$/.test(host)) return null
  return `https://${host}`
}

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
    const raw = status.environment_url || status.target_url
    if (!raw) return { state: 'pending' }
    const url = validatePreviewUrl(raw)
    if (!url) return { state: 'failed', detail: 'Preview URL is not an https *.vercel.app address' }
    return { state: 'ready', url, deploymentId: newest.id, sha: newest.sha }
  }
  if (status.state === 'failure' || status.state === 'error') {
    return { state: 'failed', detail: `Vercel preview deployment ${status.state}` }
  }
  return { state: 'pending' }
}
