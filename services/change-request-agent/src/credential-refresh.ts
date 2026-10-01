import { addRedactions, log } from './log'

/**
 * Long-running single-repo runs (Family Host managed agents, `LAUNCH.timeout_seconds`
 * up to 7200 seconds) can outlive the GitHub token minted at
 * claim time. When the platform sets `FH_CREDENTIAL_URL` / `FH_RUN_CREDENTIAL`
 * (see managed-agents-contract.md, "token refresh"), this module refreshes the
 * worker's GITHUB_TOKEN on a timer for as long as the process is alive.
 *
 * Wire contract, confirmed against the broker source (not a guess):
 * `POST {FH_CREDENTIAL_URL}` (the platform sets this to
 * `{public_url}/api/agent-credentials/github`) with
 * `Authorization: Bearer {FH_RUN_CREDENTIAL}` and no request body. See
 * family-host-worktrees/managed-agents-integration/family_host/family_host_server.py:2782
 * (route) and family_host/family_host.py:8585 `refresh_agent_github_token`
 * (handler). On success (200) the JSON body is
 * `{ "token": string, "repository": string, "expires_at": string (ISO 8601) }`
 * — NOT `{ "GITHUB_TOKEN": ... }`. `repository` is the `owner/repo` this
 * token is scoped to; the caller can compare it against its own configured
 * repo as a sanity check.
 */

export interface CredentialRefreshDeps {
  fetchImpl?: typeof fetch
  now?: () => number
  setTimeoutImpl?: typeof setTimeout
  clearTimeoutImpl?: typeof clearTimeout
}

export interface RefreshedCredential {
  token: string
  repository: string
  expiresAt: string
}

export interface CredentialRefreshOptions {
  url: string
  runCredential: string
  intervalMs: number
  /**
   * Repository this worker is configured for (`config.githubRepo`). When
   * set, a refresh whose `repository` doesn't match is treated as an error
   * (not applied) instead of silently installing a token for the wrong repo.
   */
  expectedRepository?: string
  /** Called with the new token on every successful refresh. Never called with the old one. */
  onRefreshed: (newToken: string, credential: RefreshedCredential) => void
  onError?: (error: unknown) => void
}

export interface CredentialRefreshHandle {
  stop(): void
}

/** Pure parse of the refresh endpoint's response body. Throws on anything unusable. */
export function parseCredentialResponse(body: unknown, nowMs = Date.now()): RefreshedCredential {
  if (body && typeof body === 'object') {
    const { token, repository, expires_at: expiresAt } = body as Record<string, unknown>
    if (
      typeof token === 'string' &&
      token.trim().length >= 8 &&
      typeof repository === 'string' &&
      repository.trim().length > 0 &&
      typeof expiresAt === 'string' &&
      Number.isFinite(Date.parse(expiresAt.trim())) &&
      Date.parse(expiresAt.trim()) > nowMs
    ) {
      return { token: token.trim(), repository: repository.trim(), expiresAt: expiresAt.trim() }
    }
  }
  throw new Error(
    'credential refresh response did not contain a usable {token, repository, expires_at}'
  )
}

export async function refreshGithubCredential(
  url: string,
  runCredential: string,
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now
): Promise<RefreshedCredential> {
  const res = await fetchImpl(url, {
    method: 'POST',
    redirect: 'error',
    headers: { Authorization: `Bearer ${runCredential}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    throw new Error(`credential refresh request failed: HTTP ${res.status}`)
  }
  const body = (await res.json()) as unknown
  return parseCredentialResponse(body, now())
}

/**
 * Start refreshing on an interval. The first refresh happens after one
 * interval (the token minted at claim time is assumed fresh); every
 * subsequent tick refreshes again, so an unbounded run keeps a live token.
 * Old tokens stay redacted (`addRedactions` is additive); the new token is
 * only ever handed to `onRefreshed`, never logged, never put in the Claude
 * child process env (see claude.ts's allowlist) or any tool-facing env.
 */
export function startCredentialRefresh(
  options: CredentialRefreshOptions,
  deps: CredentialRefreshDeps = {}
): CredentialRefreshHandle {
  const fetchImpl = deps.fetchImpl ?? fetch
  const setTimeoutImpl = deps.setTimeoutImpl ?? setTimeout
  const clearTimeoutImpl = deps.clearTimeoutImpl ?? clearTimeout
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const tick = async (): Promise<void> => {
    if (stopped) return
    try {
      const credential = await refreshGithubCredential(
        options.url,
        options.runCredential,
        fetchImpl,
        deps.now
      )
      if (stopped) return
      if (options.expectedRepository && credential.repository !== options.expectedRepository) {
        throw new Error(
          `credential refresh returned a token for "${credential.repository}", expected "${options.expectedRepository}"`
        )
      }
      addRedactions([credential.token])
      options.onRefreshed(credential.token, credential)
      log.info('github credential refreshed', { expiresAt: credential.expiresAt })
    } catch (error) {
      if (stopped) return
      log.warn('github credential refresh failed; keeping the current token', {
        error: String(error),
      })
      options.onError?.(error)
    } finally {
      if (!stopped) timer = setTimeoutImpl(tick, options.intervalMs)
    }
  }

  timer = setTimeoutImpl(tick, options.intervalMs)
  return {
    stop() {
      stopped = true
      if (timer) clearTimeoutImpl(timer)
    },
  }
}
