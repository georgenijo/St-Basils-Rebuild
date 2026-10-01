import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  changeRequestThumbnailPath,
  loadChangeRequestDetail,
  UUID_PATTERN,
} from './change-request-detail'
import type { ChangeRequestFile } from '@/types/change-request'

const LATENCY_MS = 50
const REQUEST_ID = '11111111-1111-4111-8111-111111111111'
const REQUESTER_ID = '22222222-2222-4222-8222-222222222222'
const REPLIER_ID = '33333333-3333-4333-8333-333333333333'

/** Supabase-like client whose every query resolves after LATENCY_MS. */
function fakeClient(tables: Record<string, unknown>) {
  const started: { table: string; at: number; filters: [string, unknown][] }[] = []
  const client = {
    from(table: string) {
      const entry = { table, at: Date.now(), filters: [] as [string, unknown][] }
      started.push(entry)
      const result = () =>
        new Promise<{ data: unknown; error: null }>((resolve) =>
          setTimeout(() => resolve({ data: tables[table] ?? null, error: null }), LATENCY_MS)
        )
      const builder = {
        select: () => builder,
        order: () => builder,
        eq: (column: string, value: unknown) => {
          entry.filters.push([column, value])
          return builder
        },
        in: (column: string, value: unknown) => {
          entry.filters.push([column, value])
          return builder
        },
        maybeSingle: () => result(),
        then: (
          onFulfilled: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown
        ) => result().then(onFulfilled, onRejected),
      }
      return builder
    },
  }
  return { client: client as never, started }
}

function fileRow(overrides: Partial<ChangeRequestFile> = {}): ChangeRequestFile {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    request_id: REQUEST_ID,
    kind: 'verification',
    storage_path: `requests/${REQUEST_ID}/verification/after.png`,
    filename: 'after.png',
    content_type: 'image/png',
    size_bytes: 1024,
    label: 'After',
    created_at: '2026-09-30T12:00:00Z',
    ...overrides,
  }
}

describe('loadChangeRequestDetail', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts every read at once and finishes in two round trips, not three', async () => {
    const tables: Record<string, unknown> = {
      change_requests: { id: REQUEST_ID, requester_id: REQUESTER_ID, title: 'Fix footer' },
      change_request_messages: [
        { id: 'm1', author_kind: 'agent', author_id: null, body: 'Working on it' },
        { id: 'm2', author_kind: 'requester', author_id: REPLIER_ID, body: 'Thanks' },
        { id: 'm3', author_kind: 'requester', author_id: REQUESTER_ID, body: 'Also this' },
      ],
      change_request_files: [fileRow()],
      profiles: [
        { id: REQUESTER_ID, full_name: 'Mary Thomas', email: null },
        { id: REPLIER_ID, full_name: null, email: 'office@example.org' },
      ],
    }
    const { client, started } = fakeClient(tables)
    const signStartedAt: number[] = []
    const sign = vi.fn(
      (files: ChangeRequestFile[]) =>
        new Promise<(ChangeRequestFile & { url: string })[]>((resolve) => {
          signStartedAt.push(Date.now())
          setTimeout(
            () => resolve(files.map((file) => ({ ...file, url: `https://signed/${file.id}` }))),
            LATENCY_MS
          )
        })
    )

    const detail = loadChangeRequestDetail(client, REQUEST_ID, sign)
    const settled = { request: false, messages: false, files: false, names: false }
    for (const key of Object.keys(settled) as (keyof typeof settled)[]) {
      void detail[key].then(() => (settled[key] = true))
    }

    // The three table reads go out together, before any of them returns.
    expect(started.map((entry) => [entry.table, entry.at])).toEqual([
      ['change_requests', 0],
      ['change_request_messages', 0],
      ['change_request_files', 0],
    ])

    await vi.advanceTimersByTimeAsync(LATENCY_MS)
    expect(settled).toEqual({ request: true, messages: true, files: false, names: false })
    // Signing and the name lookup then run side by side.
    expect(signStartedAt).toEqual([LATENCY_MS])
    expect(started.filter((entry) => entry.table === 'profiles')).toHaveLength(1)
    expect(started.at(-1)?.at).toBe(LATENCY_MS)

    await vi.advanceTimersByTimeAsync(LATENCY_MS)
    expect(settled).toEqual({ request: true, messages: true, files: true, names: true })

    // One profiles query covers the requester and every author, deduplicated.
    const profilesQuery = started.find((entry) => entry.table === 'profiles')
    expect(profilesQuery?.filters).toEqual([['id', [REQUESTER_ID, REPLIER_ID]]])
    const names = await detail.names
    expect(names.get(REQUESTER_ID)).toBe('Mary Thomas')
    expect(names.get(REPLIER_ID)).toBe('office@example.org')

    const files = await detail.files
    expect(files[0].url).toBe(`https://signed/${files[0].id}`)
    expect(sign).toHaveBeenCalledTimes(1)
    expect(started.slice(0, 3).map((entry) => entry.filters)).toEqual([
      [['id', REQUEST_ID]],
      [['request_id', REQUEST_ID]],
      [['request_id', REQUEST_ID]],
    ])
  })

  it('resolves a missing request to null with empty streamed sections', async () => {
    const { client } = fakeClient({ change_request_messages: [], change_request_files: [] })
    const sign = vi.fn(async (files: ChangeRequestFile[]) =>
      files.map((f) => ({ ...f, url: null }))
    )

    const detail = loadChangeRequestDetail(client, REQUEST_ID, sign)
    await vi.advanceTimersByTimeAsync(LATENCY_MS * 2)

    await expect(detail.request).resolves.toBeNull()
    await expect(detail.messages).resolves.toEqual([])
    await expect(detail.files).resolves.toEqual([])
    await expect(detail.names).resolves.toEqual(new Map())
  })

  it('does not raise unhandled rejections for reads a page never awaits', async () => {
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    try {
      const { client } = fakeClient({ change_requests: null })
      const sign = vi.fn(async () => {
        throw new Error('storage down')
      })
      const detail = loadChangeRequestDetail(client, REQUEST_ID, sign)
      await vi.advanceTimersByTimeAsync(LATENCY_MS * 2)
      await vi.waitFor(() => expect(detail.request).resolves.toBeNull())
      await expect(detail.files).rejects.toThrow('storage down')
      expect(unhandled).not.toHaveBeenCalled()
    } finally {
      process.off('unhandledRejection', unhandled)
    }
  })
})

describe('changeRequestThumbnailPath', () => {
  it('builds a stable same-origin URL per file row', () => {
    expect(changeRequestThumbnailPath(fileRow())).toBe(
      `/admin/requests/${REQUEST_ID}/files/44444444-4444-4444-8444-444444444444/thumbnail`
    )
  })

  it('pairs with the UUID guard the route applies', () => {
    expect(UUID_PATTERN.test(REQUEST_ID)).toBe(true)
    expect(UUID_PATTERN.test('../etc')).toBe(false)
  })
})
