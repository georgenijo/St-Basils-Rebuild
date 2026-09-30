import 'server-only'

import { logger } from '@/lib/logger'

const TRIGGER_URL = 'https://family.georgenijo.com/api/automation/agents/run'
const log = logger.child({ scope: 'change-request-agent' })

export type AgentDispatch = 'accepted' | 'unavailable' | 'not_configured'

/** Wake a one-shot worker; the database claim remains the authority for ownership. */
export async function triggerChangeRequestAgent(requestId: string): Promise<AgentDispatch> {
  const token = process.env.FAMILY_HOST_AGENT_TRIGGER_TOKEN?.trim()
  if (!token) return 'not_configured'

  try {
    const response = await fetch(TRIGGER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { request_id: requestId } }),
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    })
    // Do not consume or log response bodies: errors can contain credential material.
    await response.body?.cancel()
    if (response.status === 202) {
      log.info('change_request.agent_dispatch_accepted', { requestId })
      return 'accepted'
    }
    log.warn('change_request.agent_dispatch_unavailable', { requestId, status: response.status })
  } catch {
    // A lost response may still mean a run was queued. A later wakeup is safe:
    // concurrent workers must win the existing atomic Supabase claim first.
    log.warn('change_request.agent_dispatch_unavailable', { requestId })
  }
  return 'unavailable'
}
