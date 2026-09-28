import { describe, expect, it } from 'vitest'

import { healthStatus, STUCK_AFTER_MS } from './health'

describe('healthStatus', () => {
  const now = 1_000_000_000

  it('is ok when the loop ticked recently', () => {
    const result = healthStatus({ startedAt: now - 5000, lastLoopAt: now - 1000, busy: false }, now)
    expect(result.ok).toBe(true)
    expect(JSON.parse(result.body)).toMatchObject({ status: 'ok', busy: false, uptimeSeconds: 5 })
  })

  it('is ok while a long job is running even without recent ticks', () => {
    const state = { startedAt: 0, lastLoopAt: now - STUCK_AFTER_MS * 3, busy: true }
    expect(healthStatus(state, now).ok).toBe(true)
  })

  it('reports stuck when an idle loop stops ticking', () => {
    const state = { startedAt: 0, lastLoopAt: now - STUCK_AFTER_MS - 1, busy: false }
    const result = healthStatus(state, now)
    expect(result.ok).toBe(false)
    expect(JSON.parse(result.body).status).toBe('stuck')
  })
})
