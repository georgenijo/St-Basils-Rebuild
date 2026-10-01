import { beforeEach, describe, expect, it, vi } from 'vitest'

const ID = '0b6c3f1e-2d4a-4c8b-9e7f-1a2b3c4d5e6f'

let requestRow: { status: string; updated_at: string } | null = null
let messageCount: number | null = 0
let fileCount: number | null = 0
const queries: { table: string; filters: [string, unknown][]; head?: boolean }[] = []

function from(table: string) {
  const query = {
    table,
    filters: [] as [string, unknown][],
    head: undefined as boolean | undefined,
  }
  queries.push(query)
  const builder = {
    select: (_columns: string, options?: { head?: boolean }) => {
      query.head = options?.head
      return builder
    },
    eq: (column: string, value: unknown) => {
      query.filters.push([column, value])
      if (table === 'change_request_messages') {
        return Promise.resolve({ count: messageCount, error: null })
      }
      if (table === 'change_request_files') {
        return Promise.resolve({ count: fileCount, error: null })
      }
      return builder
    },
    maybeSingle: () => Promise.resolve({ data: requestRow, error: null }),
  }
  return builder
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ from })),
}))

const { getChangeRequestLiveState } = await import('@/actions/change-request-live')

beforeEach(() => {
  queries.length = 0
  requestRow = { status: 'verifying', updated_at: '2026-09-30T10:20:00Z' }
  messageCount = 4
  fileCount = 2
})

describe('getChangeRequestLiveState', () => {
  it('returns the status, last update, and message count of a request', async () => {
    await expect(getChangeRequestLiveState(ID)).resolves.toEqual({
      status: 'verifying',
      updatedAt: '2026-09-30T10:20:00Z',
      messageCount: 4,
      fileCount: 2,
    })
    expect(queries).toEqual([
      { table: 'change_requests', filters: [['id', ID]], head: undefined },
      { table: 'change_request_messages', filters: [['request_id', ID]], head: true },
      { table: 'change_request_files', filters: [['request_id', ID]], head: true },
    ])
  })

  it('returns null when RLS hides the request (non-admin or unknown id)', async () => {
    requestRow = null
    await expect(getChangeRequestLiveState(ID)).resolves.toBeNull()
  })

  it('rejects malformed ids without querying', async () => {
    await expect(getChangeRequestLiveState('not-a-uuid')).resolves.toBeNull()
    await expect(getChangeRequestLiveState(42 as unknown as string)).resolves.toBeNull()
    expect(queries).toHaveLength(0)
  })

  it('treats missing counts as zero', async () => {
    messageCount = null
    fileCount = null
    await expect(getChangeRequestLiveState(ID)).resolves.toMatchObject({
      messageCount: 0,
      fileCount: 0,
    })
  })
})
