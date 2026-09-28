import { beforeEach, describe, expect, it, vi } from 'vitest'

const listings = new Map<string, { name: string; created_at: string | null }[]>()
const removed: string[][] = []

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        list: (folder: string) =>
          Promise.resolve({ data: listings.get(folder) ?? [], error: null }),
        remove: (paths: string[]) => {
          removed.push(paths)
          return Promise.resolve({ data: [], error: null })
        },
      }),
    },
  }),
}))

vi.mock('@/lib/logger', () => ({
  logger: { child: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}))

import { sweepStalePendingUploads } from '@/lib/change-request-storage'

const NOW = Date.parse('2026-09-28T12:00:00Z')
const HOUR = 60 * 60 * 1000
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString()

beforeEach(() => {
  listings.clear()
  removed.length = 0
})

describe('sweepStalePendingUploads', () => {
  it('removes only sessions whose objects are all older than the cutoff', async () => {
    listings.set('pending', [
      { name: 'stale', created_at: null },
      { name: 'mixed', created_at: null },
      { name: 'fresh', created_at: null },
      { name: 'empty', created_at: null },
    ])
    listings.set('pending/stale', [
      { name: 'a.png', created_at: iso(3 * HOUR) },
      { name: 'b.pdf', created_at: iso(4 * HOUR) },
    ])
    listings.set('pending/mixed', [
      { name: 'a.png', created_at: iso(3 * HOUR) },
      { name: 'b.png', created_at: iso(HOUR / 2) },
    ])
    listings.set('pending/fresh', [{ name: 'a.png', created_at: iso(60_000) }])

    const count = await sweepStalePendingUploads({ olderThanMs: 2 * HOUR, now: NOW })

    expect(count).toBe(2)
    expect(removed).toEqual([['pending/stale/a.png', 'pending/stale/b.pdf']])
  })
})
