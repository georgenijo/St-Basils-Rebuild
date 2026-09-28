import { beforeEach, describe, expect, it, vi } from 'vitest'

const listings = new Map<string, { name: string; created_at: string | null }[]>()
const removed: string[][] = []
let submittingRows: { id: string }[] = []
const submittingQuery: [string, unknown][] = []
const fileRows = new Map<string, { storage_path: string }[]>()
const deletes: [string, unknown][][] = []

function from(table: string) {
  if (table === 'change_requests') {
    return {
      select: () => {
        const builder = {
          eq: (column: string, value: unknown) => {
            submittingQuery.push([column, value])
            return builder
          },
          lt: (column: string, value: unknown) => {
            submittingQuery.push([column, value])
            return builder
          },
          limit: () => Promise.resolve({ data: submittingRows, error: null }),
        }
        return builder
      },
      delete: () => {
        const filters: [string, unknown][] = []
        const builder = {
          eq: (column: string, value: unknown) => {
            filters.push([column, value])
            if (filters.length === 2) {
              deletes.push(filters)
              return Promise.resolve({ error: null })
            }
            return builder
          },
        }
        return builder
      },
    }
  }
  return {
    select: () => ({
      eq: (_column: string, id: string) =>
        Promise.resolve({ data: fileRows.get(id) ?? [], error: null }),
    }),
  }
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from,
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

import { sweepAbandonedSubmissions, sweepStalePendingUploads } from '@/lib/change-request-storage'

const NOW = Date.parse('2026-09-28T12:00:00Z')
const HOUR = 60 * 60 * 1000
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString()

beforeEach(() => {
  listings.clear()
  removed.length = 0
  submittingRows = []
  submittingQuery.length = 0
  fileRows.clear()
  deletes.length = 0
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

describe('sweepAbandonedSubmissions', () => {
  it('removes objects then rows of requests stuck in submitting past the cutoff', async () => {
    submittingRows = [{ id: 'r1' }]
    fileRows.set('r1', [{ storage_path: 'requests/r1/attachments/a.png' }])
    listings.set('requests/r1/attachments', [
      { name: 'a.png', created_at: iso(2 * HOUR) },
      { name: 'b.pdf', created_at: iso(2 * HOUR) },
    ])

    const count = await sweepAbandonedSubmissions({ olderThanMs: HOUR, now: NOW })

    expect(count).toBe(1)
    expect(submittingQuery).toEqual([
      ['status', 'submitting'],
      ['created_at', iso(HOUR)],
    ])
    expect(removed).toEqual([['requests/r1/attachments/a.png', 'requests/r1/attachments/b.pdf']])
    expect(deletes).toEqual([
      [
        ['id', 'r1'],
        ['status', 'submitting'],
      ],
    ])
  })

  it('does nothing when no request is abandoned', async () => {
    expect(await sweepAbandonedSubmissions({ olderThanMs: HOUR, now: NOW })).toBe(0)
    expect(removed).toHaveLength(0)
    expect(deletes).toHaveLength(0)
  })
})
