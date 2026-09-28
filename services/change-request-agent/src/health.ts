import { createServer, type Server } from 'node:http'

/** Loop heartbeat shared between the worker loop and the health endpoint. */
export interface HealthState {
  startedAt: number
  lastLoopAt: number
  busy: boolean
}

/** An idle loop that has not ticked for this long is considered stuck. */
export const STUCK_AFTER_MS = 10 * 60_000

export function healthStatus(state: HealthState, now: number): { ok: boolean; body: string } {
  const idleFor = now - state.lastLoopAt
  const ok = state.busy || idleFor < STUCK_AFTER_MS
  return {
    ok,
    body: JSON.stringify({
      status: ok ? 'ok' : 'stuck',
      busy: state.busy,
      lastLoopAt: new Date(state.lastLoopAt).toISOString(),
      uptimeSeconds: Math.round((now - state.startedAt) / 1000),
    }),
  }
}

/**
 * Minimal HTTP health endpoint so a hosting platform (Family Host) can mark
 * the worker live. Exposes only loop timing, never request data.
 */
export function startHealthServer(port: number, state: HealthState): Server {
  const server = createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end()
      return
    }
    const { ok, body } = healthStatus(state, Date.now())
    res.writeHead(ok ? 200 : 503, { 'content-type': 'application/json' })
    res.end(req.method === 'HEAD' ? undefined : body)
  })
  server.listen(port)
  return server
}
