import { describe, expect, it, vi } from 'vitest'

import { ABANDONED_MAX_AGE_MS, cleanupAbandonedSubmissions, type AbandonedDeps } from './abandoned'

function deps(overrides: Partial<AbandonedDeps> = {}): AbandonedDeps {
  return {
    listStale: vi.fn(async () => ['a', 'b']),
    listObjects: vi.fn(async (id: string) => [`requests/${id}/attachments/x.png`]),
    fileRowPaths: vi.fn(async (id: string) => [`requests/${id}/attachments/x.png`]),
    removeObjects: vi.fn(async () => {}),
    deleteIfSubmitting: vi.fn(async () => true),
    ...overrides,
  }
}

const now = new Date('2026-09-28T12:00:00Z')

describe('cleanupAbandonedSubmissions', () => {
  it('uses a one-hour cutoff, removes objects then deletes the row', async () => {
    const d = deps()
    const order: string[] = []
    d.removeObjects = vi.fn(async (paths: string[]) => {
      order.push(`remove ${paths.join(',')}`)
    })
    d.deleteIfSubmitting = vi.fn(async (id: string) => {
      order.push(`delete ${id}`)
      return true
    })
    const result = await cleanupAbandonedSubmissions(d, now)
    expect(d.listStale).toHaveBeenCalledWith(
      new Date(now.getTime() - ABANDONED_MAX_AGE_MS).toISOString()
    )
    expect(order).toEqual([
      'remove requests/a/attachments/x.png',
      'delete a',
      'remove requests/b/attachments/x.png',
      'delete b',
    ])
    expect(result).toEqual({ found: 2, deleted: 2, skipped: 0, objectsRemoved: 2 })
  })

  it('skips a request when the Storage listing fails, without touching it', async () => {
    const onSkip = vi.fn()
    const d = deps({
      listObjects: vi.fn(async (id: string) => {
        if (id === 'a') throw new Error('storage down')
        return [`requests/${id}/x.png`]
      }),
      fileRowPaths: vi.fn(async () => []),
    })
    const result = await cleanupAbandonedSubmissions(d, now, undefined, onSkip)
    expect(d.removeObjects).toHaveBeenCalledTimes(1)
    expect(d.removeObjects).toHaveBeenCalledWith(['requests/b/x.png'])
    expect(d.deleteIfSubmitting).toHaveBeenCalledTimes(1)
    expect(d.deleteIfSubmitting).toHaveBeenCalledWith('b')
    expect(onSkip).toHaveBeenCalledWith('a', expect.any(Error))
    expect(result).toMatchObject({ found: 2, deleted: 1, skipped: 1 })
  })

  it('skips a request when the file-row query fails', async () => {
    const d = deps({
      listStale: vi.fn(async () => ['a']),
      fileRowPaths: vi.fn(async () => {
        throw new Error('db down')
      }),
    })
    const result = await cleanupAbandonedSubmissions(d, now)
    expect(d.removeObjects).not.toHaveBeenCalled()
    expect(d.deleteIfSubmitting).not.toHaveBeenCalled()
    expect(result).toEqual({ found: 1, deleted: 0, skipped: 1, objectsRemoved: 0 })
  })

  it('does not delete the row when object removal fails', async () => {
    const d = deps({
      listStale: vi.fn(async () => ['a']),
      removeObjects: vi.fn(async () => {
        throw new Error('remove failed')
      }),
    })
    const result = await cleanupAbandonedSubmissions(d, now)
    expect(d.deleteIfSubmitting).not.toHaveBeenCalled()
    expect(result.skipped).toBe(1)
  })

  it('handles text-only submissions and rows that were queued meanwhile', async () => {
    const d = deps({
      listObjects: vi.fn(async () => []),
      fileRowPaths: vi.fn(async () => []),
      deleteIfSubmitting: vi.fn(async (id: string) => id === 'a'),
    })
    const result = await cleanupAbandonedSubmissions(d, now)
    expect(d.removeObjects).not.toHaveBeenCalled()
    expect(result).toEqual({ found: 2, deleted: 1, skipped: 0, objectsRemoved: 0 })
  })
})
