import { afterEach, describe, expect, it, vi } from 'vitest'

import { childEnv } from './exec'

describe('childEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('does not pass the worker tsx loader to repository commands', () => {
    vi.stubEnv('NODE_OPTIONS', '--import=tsx')
    vi.stubEnv('PATH', '/usr/bin')
    const env = childEnv()
    expect(env.NODE_OPTIONS).toBeUndefined()
    expect(env.PATH).toBe('/usr/bin')
  })

  it('never passes worker secrets', () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-secret')
    vi.stubEnv('GITHUB_TOKEN', 'github-secret')
    const env = childEnv({ CI: '1' })
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined()
    expect(env.GITHUB_TOKEN).toBeUndefined()
    expect(env.CI).toBe('1')
  })
})
