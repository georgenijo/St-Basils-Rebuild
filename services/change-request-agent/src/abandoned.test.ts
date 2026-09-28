import { describe, expect, it, vi } from 'vitest'

import {
  ABANDONED_MAX_AGE_MS,
  cleanupAbandonedSubmissions,
  sweepOrphanFolders,
  type CleanupDeps,
  type StoredObject,
} from './abandoned'

const now = new Date('2026-09-28T12:00:00Z')
const OLD = '2026-09-28T10:00:00Z'
const YOUNG = '2026-09-28T11:50:00Z'
const A = 'aaaaaaaa-1111-4111-8111-111111111111'
const B = 'bbbbbbbb-2222-4222-8222-222222222222'
const C = 'cccccccc-3333-4333-8333-333333333333'

/** In-memory Storage + table used by both cleanup steps. */
function world(opts: { rows: Record<string, string>; objects: Record<string, StoredObject[]> }) {
  const rows = new Map(Object.entries(opts.rows))
  const objects = new Map(Object.entries(opts.objects))
  const deps: CleanupDeps = {
    listStale: vi.fn(async () =>
      [...rows.entries()].filter(([, status]) => status === 'submitting').map(([id]) => id)
    ),
    deleteIfSubmitting: vi.fn(async (id: string) => {
      if (rows.get(id) !== 'submitting') return false
      rows.delete(id)
      return true
    }),
    listObjects: vi.fn(
      async (prefix: string) => objects.get(prefix.replace('requests/', '')) ?? []
    ),
    removeObjects: vi.fn(async (paths: string[]) => {
      for (const [folder, list] of objects) {
        objects.set(
          folder,
          list.filter((o) => !paths.includes(o.path))
        )
      }
    }),
    listRequestFolders: vi.fn(async (offset: number, limit: number) =>
      [...objects.keys()].slice(offset, offset + limit)
    ),
    existingRequestIds: vi.fn(async (ids: string[]) => new Set(ids.filter((id) => rows.has(id)))),
  }
  return { deps, rows, objects }
}

const obj = (id: string, name: string, createdAt: string | null = OLD): StoredObject => ({
  path: `requests/${id}/attachments/${name}`,
  createdAt,
})

describe('cleanupAbandonedSubmissions', () => {
  it('uses a one-hour cutoff, deletes the row first, then its objects', async () => {
    const w = world({ rows: { [A]: 'submitting' }, objects: { [A]: [obj(A, 'x.png')] } })
    const order: string[] = []
    const del = w.deps.deleteIfSubmitting
    w.deps.deleteIfSubmitting = vi.fn(async (id: string) => {
      order.push('delete-row')
      return del(id)
    })
    const rm = w.deps.removeObjects
    w.deps.removeObjects = vi.fn(async (paths: string[]) => {
      order.push('remove-objects')
      return rm(paths)
    })
    const result = await cleanupAbandonedSubmissions(w.deps, now)
    expect(w.deps.listStale).toHaveBeenCalledWith(
      new Date(now.getTime() - ABANDONED_MAX_AGE_MS).toISOString()
    )
    expect(order).toEqual(['delete-row', 'remove-objects'])
    expect(result).toEqual({ found: 1, deleted: 1, objectsRemoved: 1, objectRemovalFailed: 0 })
    expect(w.objects.get(A)).toEqual([])
  })

  it('keeps attachments when the request was queued in between (race)', async () => {
    const w = world({ rows: { [A]: 'submitting' }, objects: { [A]: [obj(A, 'x.png')] } })
    // listStale saw it as submitting; the web action flips it before our delete.
    w.deps.listStale = vi.fn(async () => {
      w.rows.set(A, 'queued')
      return [A]
    })
    const result = await cleanupAbandonedSubmissions(w.deps, now)
    expect(w.rows.get(A)).toBe('queued')
    expect(w.deps.removeObjects).not.toHaveBeenCalled()
    expect(w.deps.listObjects).not.toHaveBeenCalled()
    expect(w.objects.get(A)).toHaveLength(1)
    expect(result).toMatchObject({ found: 1, deleted: 0, objectsRemoved: 0 })
  })

  it('leaves objects to the orphan sweep when removal fails after the row delete', async () => {
    const w = world({ rows: { [A]: 'submitting' }, objects: { [A]: [obj(A, 'x.png')] } })
    w.deps.removeObjects = vi.fn(async () => {
      throw new Error('storage down')
    })
    const warn = vi.fn()
    const result = await cleanupAbandonedSubmissions(w.deps, now, undefined, warn)
    expect(w.rows.has(A)).toBe(false)
    expect(result).toMatchObject({ deleted: 1, objectRemovalFailed: 1 })
    expect(warn).toHaveBeenCalled()
  })

  it('skips a request whose delete errors', async () => {
    const w = world({ rows: { [A]: 'submitting' }, objects: { [A]: [obj(A, 'x.png')] } })
    w.deps.deleteIfSubmitting = vi.fn(async () => {
      throw new Error('db down')
    })
    const result = await cleanupAbandonedSubmissions(w.deps, now)
    expect(w.deps.removeObjects).not.toHaveBeenCalled()
    expect(result).toMatchObject({ found: 1, deleted: 0 })
  })
})

describe('sweepOrphanFolders', () => {
  it('removes old objects of a folder with no row', async () => {
    const w = world({ rows: {}, objects: { [A]: [obj(A, 'x.png'), obj(A, 'y.pdf')] } })
    const result = await sweepOrphanFolders(w.deps, now)
    expect(w.objects.get(A)).toEqual([])
    expect(result).toMatchObject({ orphanFolders: 1, foldersProcessed: 1, objectsRemoved: 2 })
  })

  it('leaves a folder with a live row untouched', async () => {
    const w = world({ rows: { [A]: 'queued' }, objects: { [A]: [obj(A, 'x.png')] } })
    const result = await sweepOrphanFolders(w.deps, now)
    expect(w.deps.listObjects).not.toHaveBeenCalled()
    expect(w.objects.get(A)).toHaveLength(1)
    expect(result).toMatchObject({ foldersScanned: 1, orphanFolders: 0, objectsRemoved: 0 })
  })

  it('leaves young objects (upload may still be in flight) untouched', async () => {
    const w = world({
      rows: {},
      objects: {
        [A]: [obj(A, 'young.png', YOUNG), obj(A, 'unknown.png', null), obj(A, 'old.png')],
      },
    })
    const result = await sweepOrphanFolders(w.deps, now)
    expect(w.objects.get(A)?.map((o) => o.path)).toEqual([
      `requests/${A}/attachments/young.png`,
      `requests/${A}/attachments/unknown.png`,
    ])
    expect(result).toMatchObject({ objectsRemoved: 1, objectsTooYoung: 2 })
  })

  it('removes everything with a zero threshold', async () => {
    const w = world({ rows: {}, objects: { [A]: [obj(A, 'young.png', now.toISOString())] } })
    await sweepOrphanFolders(w.deps, now, { minAgeMs: 0 })
    expect(w.objects.get(A)).toEqual([])
  })

  it('skips a folder whose listing errors and still processes the others', async () => {
    const w = world({ rows: {}, objects: { [A]: [obj(A, 'x.png')], [B]: [obj(B, 'x.png')] } })
    const list = w.deps.listObjects
    w.deps.listObjects = vi.fn(async (prefix: string) => {
      if (prefix === `requests/${A}`) throw new Error('listing failed')
      return list(prefix)
    })
    const warn = vi.fn()
    const result = await sweepOrphanFolders(w.deps, now, { warn })
    expect(w.objects.get(A)).toHaveLength(1)
    expect(w.objects.get(B)).toEqual([])
    expect(result).toMatchObject({ orphanFolders: 2, foldersProcessed: 1, foldersSkipped: 1 })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('skipped'), expect.anything())
  })

  it('skips folders when the row lookup errors', async () => {
    const w = world({ rows: {}, objects: { [A]: [obj(A, 'x.png')] } })
    w.deps.existingRequestIds = vi.fn(async () => {
      throw new Error('db down')
    })
    const result = await sweepOrphanFolders(w.deps, now)
    expect(w.deps.removeObjects).not.toHaveBeenCalled()
    expect(result).toMatchObject({ orphanFolders: 0, foldersSkipped: 1 })
  })

  it('propagates a top-level listing error (whole sweep skipped this cycle)', async () => {
    const w = world({ rows: {}, objects: { [A]: [obj(A, 'x.png')] } })
    w.deps.listRequestFolders = vi.fn(async () => {
      throw new Error('bucket listing failed')
    })
    await expect(sweepOrphanFolders(w.deps, now)).rejects.toThrow('bucket listing failed')
    expect(w.deps.removeObjects).not.toHaveBeenCalled()
  })

  it('ignores non-UUID folders and caps folders per cycle', async () => {
    const w = world({
      rows: {},
      objects: {
        'not-a-uuid': [obj('not-a-uuid', 'x.png')],
        [A]: [obj(A, 'x')],
        [B]: [obj(B, 'x')],
        [C]: [obj(C, 'x')],
      },
    })
    const result = await sweepOrphanFolders(w.deps, now, { maxFolders: 2 })
    expect(result.orphanFolders).toBe(2)
    expect(w.objects.get('not-a-uuid')).toHaveLength(1)
    expect(w.objects.get(C)).toHaveLength(1)
  })

  it('re-checks ownership right before removing and skips a folder that gained a row', async () => {
    const w = world({ rows: {}, objects: { [A]: [obj(A, 'x.png')] } })
    // The web action inserts the row after the first lookup but before removal.
    w.deps.listObjects = vi.fn(async (prefix: string) => {
      w.rows.set(A, 'submitting')
      return w.objects.get(prefix.replace('requests/', '')) ?? []
    })
    const result = await sweepOrphanFolders(w.deps, now)
    expect(w.deps.removeObjects).not.toHaveBeenCalled()
    expect(w.objects.get(A)).toHaveLength(1)
    expect(w.deps.existingRequestIds).toHaveBeenLastCalledWith([A])
    expect(result).toMatchObject({ orphanFolders: 1, foldersClaimed: 1, objectsRemoved: 0 })
  })

  it('skips removal when the ownership re-check errors', async () => {
    const w = world({ rows: {}, objects: { [A]: [obj(A, 'x.png')] } })
    let calls = 0
    w.deps.existingRequestIds = vi.fn(async () => {
      calls++
      if (calls > 1) throw new Error('db down')
      return new Set<string>()
    })
    const result = await sweepOrphanFolders(w.deps, now)
    expect(w.deps.removeObjects).not.toHaveBeenCalled()
    expect(result).toMatchObject({ orphanFolders: 1, foldersSkipped: 1, objectsRemoved: 0 })
  })

  it('does not starve: 50 uncleanable orphans ahead of a real one', async () => {
    const uuid = (n: number) => `${n.toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`
    const objects: Record<string, StoredObject[]> = {}
    // 50 stuck folders sort first: their objects have no timestamp and are never removed.
    for (let n = 1; n <= 50; n++) objects[uuid(n)] = [obj(uuid(n), 'x.png', null)]
    const target = uuid(51)
    objects[target] = [obj(target, 'x.png')]
    const w = world({ rows: {}, objects })
    const state = { cursor: 0 }

    const first = await sweepOrphanFolders(w.deps, now, { state, pageSize: 20 })
    expect(first).toMatchObject({ orphanFolders: 50, objectsRemoved: 0, nextCursor: 50 })
    expect(w.objects.get(target)).toHaveLength(1)

    const second = await sweepOrphanFolders(w.deps, now, { state, pageSize: 20 })
    expect(second).toMatchObject({ objectsRemoved: 1, nextCursor: 0 })
    expect(w.objects.get(target)).toEqual([])

    // Wraps around to the start on the following cycle.
    const third = await sweepOrphanFolders(w.deps, now, { state, pageSize: 20 })
    expect(third.orphanFolders).toBe(50)
  })

  it('restarts from 0 when the cursor points past the end', async () => {
    const w = world({ rows: {}, objects: { [A]: [obj(A, 'x.png')] } })
    const state = { cursor: 500 }
    const result = await sweepOrphanFolders(w.deps, now, { state })
    expect(result).toMatchObject({ orphanFolders: 1, objectsRemoved: 1, nextCursor: 0 })
  })
})
