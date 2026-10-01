import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks ───────────────────────────────────────────────────────────

const mockGetUser = vi.fn()
const mockRpc = vi.fn()
const userInserts: { table: string; row: unknown }[] = []
const adminInserts: { table: string; row: unknown }[] = []
const adminUpdates: { table: string; values: unknown; filters: [string, unknown][] }[] = []
const adminDeletes: { table: string; filters: [string, unknown][] }[] = []
const signedUploads: string[] = []
const moves: { from: string; to: string }[] = []
const removed: string[][] = []
const MESSAGE_ID = '99999999-9999-4999-8999-999999999999'
/** Order of side effects, to assert the row exists before any move. */
const events: string[] = []

interface FakeObject {
  bytes: Uint8Array
  size: number
  contentType: string
}
const storedObjects = new Map<string, FakeObject>()

let profile: { role: string; full_name: string | null } | null = {
  role: 'admin',
  full_name: 'Fr. Admin',
}
let requestRow: {
  id: string
  status: string
  pr_number?: number | null
  verification?: { commit_sha?: string | null } | null
} | null = null
let userInsertError: { message: string } | null = null
let fileInsertError: { message: string } | null = null
let moveFailOn: number | null = null
let requeueMatches = true
let queueError: { message: string } | null = null
// Re-read after an unconfirmed queue flip, and the guarded rollback delete.
let rereadRow: { status: string } | null = { status: 'submitting' }
let rereadError: { message: string } | null = null
let deleteMatches = true
let deleteError: { message: string } | null = null

function userFrom(table: string) {
  if (table === 'profiles') {
    return {
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: profile, error: null }) }),
      }),
    }
  }
  if (table === 'change_requests') {
    return {
      insert: (row: unknown) => {
        userInserts.push({ table, row })
        events.push('insert:change_requests')
        return Promise.resolve({ error: userInsertError })
      },
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: requestRow, error: null }) }),
      }),
    }
  }
  if (table === 'change_request_messages') {
    return {
      insert: (row: unknown) => {
        userInserts.push({ table, row })
        return {
          select: () => ({
            single: () => Promise.resolve({ data: { id: MESSAGE_ID }, error: null }),
          }),
        }
      },
    }
  }
  throw new Error(`Unexpected user-client table: ${table}`)
}

function adminFrom(table: string) {
  return {
    insert: (row: unknown) => {
      adminInserts.push({ table, row })
      return Promise.resolve({ error: table === 'change_request_files' ? fileInsertError : null })
    },
    update: (values: unknown) => {
      const filters: [string, unknown][] = []
      const builder = {
        eq: (column: string, value: unknown) => {
          filters.push([column, value])
          return builder
        },
        select: () => {
          adminUpdates.push({ table, values, filters })
          const isQueueFlip =
            (values as { status?: string }).status === 'queued' &&
            filters.some(([column, value]) => column === 'status' && value === 'submitting')
          if (isQueueFlip && queueError) return Promise.resolve({ data: null, error: queueError })
          return Promise.resolve({ data: requeueMatches ? [{ id: 'x' }] : [], error: null })
        },
      }
      return builder
    },
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: rereadRow, error: rereadError }),
      }),
    }),
    delete: () => {
      const filters: [string, unknown][] = []
      const builder = {
        eq: (column: string, value: unknown) => {
          filters.push([column, value])
          return builder
        },
        select: () => {
          adminDeletes.push({ table, filters })
          if (deleteError) return Promise.resolve({ data: null, error: deleteError })
          return Promise.resolve({ data: deleteMatches ? [{ id: 'x' }] : [], error: null })
        },
      }
      return builder
    },
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({ auth: { getUser: mockGetUser }, from: userFrom, rpc: mockRpc })
  ),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: adminFrom,
    storage: {
      from: () => ({
        createSignedUploadUrl: (path: string) => {
          signedUploads.push(path)
          return Promise.resolve({
            data: { path, token: `tok-${signedUploads.length}`, signedUrl: `https://s/${path}` },
            error: null,
          })
        },
        move: (from: string, to: string) => {
          if (moveFailOn !== null && moves.length === moveFailOn) {
            return Promise.resolve({ data: null, error: { message: 'storage down' } })
          }
          moves.push({ from, to })
          events.push('move')
          return Promise.resolve({ data: {}, error: null })
        },
        remove: (paths: string[]) => {
          removed.push(paths)
          return Promise.resolve({ data: [], error: null })
        },
      }),
    },
  })),
}))

const mockAfter = vi.fn()
vi.mock('next/server', () => ({ after: (callback: () => unknown) => mockAfter(callback) }))

const mockSweep = vi.fn(async () => 0)
const mockSweepSubmitting = vi.fn(async () => 0)
vi.mock('@/lib/change-request-storage', () => ({
  CHANGE_REQUESTS_BUCKET: 'change-requests',
  sweepStalePendingUploads: (...args: unknown[]) => mockSweep(...(args as [])),
  sweepAbandonedSubmissions: (...args: unknown[]) => mockSweepSubmitting(...(args as [])),
  readStoredObjectHead: vi.fn(async (path: string) => {
    const object = storedObjects.get(path)
    return object
      ? { bytes: object.bytes.slice(0, 32), size: object.size, contentType: object.contentType }
      : null
  }),
}))

const mockSendEmail = vi.fn()
vi.mock('@/lib/email', () => ({ sendEmail: (...args: unknown[]) => mockSendEmail(...args) }))
const mockTriggerAgent = vi.fn()
vi.mock('@/lib/change-request-agent', () => ({
  triggerChangeRequestAgent: (...args: unknown[]) => mockTriggerAgent(...args),
}))

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`)
})
vi.mock('next/navigation', () => ({ redirect: (url: string) => mockRedirect(url) }))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

vi.mock('@/lib/logger', () => ({
  logger: {
    child: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  },
}))

vi.mock('@/lib/logger.server', () => ({
  withLogging: vi.fn((_name: string, action: unknown) => action),
}))

import {
  addChangeRequestMessage,
  closeChangeRequest,
  createChangeRequest,
  prepareChangeRequestUploads,
} from '@/actions/change-requests'
import { createUploadSession } from '@/lib/change-request-uploads'

// ─── Helpers ─────────────────────────────────────────────────────────

const USER_ID = '550e8400-e29b-41d4-a716-446655440001'
const OTHER_USER_ID = '550e8400-e29b-41d4-a716-446655440009'
const REQUEST_ID = '550e8400-e29b-41d4-a716-446655440002'
const INITIAL = { success: false, message: '' }
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
const PDF = new TextEncoder().encode('%PDF-1.7\n%...')
const MB = 1024 * 1024

function pendingPath(sessionId: string, name: string) {
  return `pending/${sessionId}/${crypto.randomUUID()}-${name}`
}

/** Simulate the browser having uploaded objects under a minted session. */
function uploadedSession(
  objects: { name: string; bytes?: Uint8Array; size?: number; contentType?: string }[],
  userId = USER_ID
) {
  const session = createUploadSession(userId)
  const paths = objects.map((object) => {
    const path = pendingPath(session.sessionId, object.name)
    const bytes = object.bytes ?? PNG
    storedObjects.set(path, {
      bytes,
      size: object.size ?? bytes.byteLength,
      contentType: object.contentType ?? 'image/png',
    })
    return path
  })
  return { ...session, paths }
}

function requestForm(upload?: { sessionId: string; token: string; paths: string[] }) {
  const formData = new FormData()
  formData.set('title', 'Replace feast flyer')
  formData.set('description', 'Swap the homepage flyer for the attached one, please.')
  formData.set('page_path', '/')
  formData.set('target_selector', 'main > section:nth-of-type(2) > img')
  formData.set('target_text', 'Feast flyer')
  if (upload) {
    formData.set('upload_session', upload.sessionId)
    formData.set('upload_token', upload.token)
    upload.paths.forEach((path) => formData.append('attachment_paths', path))
  }
  return formData
}

async function expectRedirect(promise: Promise<unknown>): Promise<string> {
  const error = await promise.then(
    () => null,
    (reason: Error) => reason
  )
  expect(error?.message).toMatch(/^NEXT_REDIRECT:/)
  return error!.message.replace('NEXT_REDIRECT:', '')
}

beforeEach(() => {
  vi.clearAllMocks()
  userInserts.length = 0
  adminInserts.length = 0
  adminUpdates.length = 0
  adminDeletes.length = 0
  signedUploads.length = 0
  moves.length = 0
  events.length = 0
  removed.length = 0
  storedObjects.clear()
  profile = { role: 'admin', full_name: 'Fr. Admin' }
  requestRow = null
  userInsertError = null
  fileInsertError = null
  moveFailOn = null
  requeueMatches = true
  queueError = null
  rereadRow = { status: 'submitting' }
  rereadError = null
  deleteMatches = true
  deleteError = null
  mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID, email: 'admin@example.org' } } })
  mockSendEmail.mockResolvedValue({ data: {}, error: null })
  mockTriggerAgent.mockResolvedValue('not_configured')
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
  process.env.CHANGE_REQUEST_NOTIFY_EMAIL = 'george@example.com'
  process.env.NEXT_PUBLIC_SITE_URL = 'https://stbasilsboston.org'
  delete process.env.VERCEL_URL
})

// ─── prepareChangeRequestUploads ─────────────────────────────────────

describe('prepareChangeRequestUploads', () => {
  it('rejects non-admins before minting anything', async () => {
    profile = { role: 'member', full_name: null }
    const result = await prepareChangeRequestUploads([
      { name: 'a.png', type: 'image/png', size: 10 },
    ])
    expect(result).toEqual({ success: false, message: 'Forbidden: admin access required' })
    expect(signedUploads).toHaveLength(0)
  })

  it.each([
    ['a disallowed type', [{ name: 'a.svg', type: 'image/svg+xml', size: 10 }], /PNG, JPEG/],
    ['an oversized file', [{ name: 'a.png', type: 'image/png', size: 10 * MB + 1 }], /10 MB/],
    ['an empty file', [{ name: 'a.png', type: 'image/png', size: 0 }], /empty/],
    [
      'too many files',
      Array.from({ length: 6 }, (_, i) => ({ name: `${i}.png`, type: 'image/png', size: 1 })),
      /at most 5/,
    ],
    ['a non-array payload', 'nope', /./],
  ])('rejects %s', async (_label, files, message) => {
    const result = await prepareChangeRequestUploads(files)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.message).toMatch(message)
    expect(signedUploads).toHaveLength(0)
  })

  it('mints one signed upload URL per file under a fresh pending session', async () => {
    const result = await prepareChangeRequestUploads([
      { name: '../Feast Flyer.png', type: 'image/png', size: 5 * MB },
      { name: 'schedule', type: 'application/pdf', size: 100 },
    ])
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.uploads).toHaveLength(2)
    expect(result.uploads[0].path).toMatch(
      new RegExp(`^pending/${result.sessionId}/[0-9a-f-]{36}-Feast-Flyer\\.png$`)
    )
    expect(result.uploads[1].path).toMatch(/-schedule\.pdf$/)
    expect(result.uploads[0].token).toBe('tok-1')
    expect(result.sessionToken).toMatch(/^\d+\.[\w-]+$/)

    // Stale pending uploads are swept after the response.
    expect(mockAfter).toHaveBeenCalledTimes(1)
    await mockAfter.mock.calls[0][0]()
    expect(mockSweep).toHaveBeenCalledWith({ olderThanMs: expect.any(Number) })
    expect(mockSweepSubmitting).toHaveBeenCalledWith({ olderThanMs: 60 * 60 * 1000 })
  })
})

// ─── createChangeRequest ─────────────────────────────────────────────

describe('createChangeRequest', () => {
  it('rejects a signed-out user before touching data', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const result = await createChangeRequest(INITIAL, requestForm())
    expect(result).toEqual({ success: false, message: 'Unauthorized' })
    expect(userInserts).toHaveLength(0)
  })

  it('rejects a non-admin', async () => {
    profile = { role: 'member', full_name: 'Member' }
    const result = await createChangeRequest(INITIAL, requestForm())
    expect(result).toEqual({ success: false, message: 'Forbidden: admin access required' })
    expect(userInserts).toHaveLength(0)
  })

  it('returns field errors and discards pending uploads for invalid input', async () => {
    const upload = uploadedSession([{ name: 'a.png' }])
    const formData = requestForm(upload)
    formData.set('page_path', '//evil.example')
    const result = await createChangeRequest(INITIAL, formData)
    expect(result.errors).toHaveProperty('page_path')
    expect(userInserts).toHaveLength(0)
    expect(removed).toEqual([upload.paths])
  })

  it('creates a request without attachments', async () => {
    const url = await expectRedirect(createChangeRequest(INITIAL, requestForm()))
    const row = userInserts[0].row as Record<string, unknown>
    expect(url).toBe(`/admin/requests/${row.id}`)
    expect(adminInserts).toHaveLength(0)
    expect(moves).toHaveLength(0)
  })

  it('verifies uploads, moves them into the request folder, records files, emails, and redirects', async () => {
    const upload = uploadedSession([
      { name: 'Feast-Flyer.png' },
      { name: 'schedule.pdf', bytes: PDF, contentType: 'application/pdf', size: 3 * MB },
    ])

    const url = await expectRedirect(createChangeRequest(INITIAL, requestForm(upload)))

    const row = userInserts.find((entry) => entry.table === 'change_requests')?.row as Record<
      string,
      unknown
    >
    expect(row).toMatchObject({
      requester_id: USER_ID,
      title: 'Replace feast flyer',
      page_path: '/',
      target_selector: 'main > section:nth-of-type(2) > img',
      target_text: 'Feast flyer',
    })
    // Inserted as 'submitting' (not claimable), flipped to 'queued' last.
    expect(row.status).toBe('submitting')
    // The row exists before anything lands under requests/<id>/ (the worker's
    // orphan sweep removes objects there that have no request row).
    expect(events).toEqual(['insert:change_requests', 'move', 'move'])
    const requestId = row.id as string
    expect(adminUpdates).toEqual([
      {
        table: 'change_requests',
        values: { status: 'queued' },
        filters: [
          ['id', requestId],
          ['status', 'submitting'],
        ],
      },
    ])
    expect(url).toBe(`/admin/requests/${requestId}`)

    expect(moves).toHaveLength(2)
    moves.forEach((move, index) => {
      expect(move.from).toBe(upload.paths[index])
      expect(move.to).toBe(
        `requests/${requestId}/attachments/${upload.paths[index].split('/').pop()}`
      )
    })

    const fileRows = adminInserts.find((entry) => entry.table === 'change_request_files')
      ?.row as Record<string, unknown>[]
    expect(fileRows).toEqual([
      {
        request_id: requestId,
        kind: 'attachment',
        storage_path: moves[0].to,
        filename: 'Feast-Flyer.png',
        content_type: 'image/png',
        size_bytes: PNG.byteLength,
      },
      {
        request_id: requestId,
        kind: 'attachment',
        storage_path: moves[1].to,
        filename: 'schedule.pdf',
        content_type: 'application/pdf',
        size_bytes: 3 * MB,
      },
    ])
    expect(removed).toHaveLength(0)

    expect(mockSendEmail).toHaveBeenCalledTimes(1)
    const email = mockSendEmail.mock.calls[0][0]
    expect(email.to).toEqual(['george@example.com'])
    expect(email.subject).toContain('Replace feast flyer')
    expect(email.metadata).toMatchObject({
      template: 'change-request-notification',
      requestId,
      requestUrl: `https://stbasilsboston.org/admin/requests/${requestId}`,
      requesterName: 'Fr. Admin',
      pagePath: '/',
    })
  })

  it('rejects a session token minted for another admin without deleting anything', async () => {
    const upload = uploadedSession([{ name: 'a.png' }], OTHER_USER_ID)
    const result = await createChangeRequest(INITIAL, requestForm(upload))
    expect(result.errors?.attachments?.[0]).toMatch(/expired/)
    expect(userInserts).toHaveLength(0)
    expect(removed).toHaveLength(0)
    expect(moves).toHaveLength(0)
  })

  it('rejects a tampered or missing session token', async () => {
    const upload = uploadedSession([{ name: 'a.png' }])
    const tampered = requestForm({ ...upload, token: `${upload.token}x` })
    expect((await createChangeRequest(INITIAL, tampered)).errors).toHaveProperty('attachments')

    const missing = requestForm(upload)
    missing.delete('upload_token')
    expect((await createChangeRequest(INITIAL, missing)).errors).toHaveProperty('attachments')
    expect(userInserts).toHaveLength(0)
  })

  it('rejects paths outside the minted pending prefix', async () => {
    const upload = uploadedSession([{ name: 'a.png' }])
    const other = createUploadSession(USER_ID)
    for (const path of [
      `requests/${REQUEST_ID}/attachments/${crypto.randomUUID()}-a.png`,
      pendingPath(other.sessionId, 'a.png'),
      `pending/${upload.sessionId}/../../requests/x.png`,
    ]) {
      const result = await createChangeRequest(
        INITIAL,
        requestForm({ ...upload, paths: [...upload.paths, path] })
      )
      expect(result.errors?.attachments?.[0]).toMatch(/not recognized/)
    }
    expect(userInserts).toHaveLength(0)
    expect(moves).toHaveLength(0)
  })

  it('rejects an upload whose bytes are not an allowed type', async () => {
    const upload = uploadedSession([
      { name: 'flyer.png', bytes: new TextEncoder().encode('<svg onload=alert(1)>') },
    ])
    const result = await createChangeRequest(INITIAL, requestForm(upload))
    expect(result.errors?.attachments?.[0]).toMatch(/not a valid PNG/)
    expect(userInserts).toHaveLength(0)
    expect(removed).toEqual([upload.paths])
  })

  it('rejects an upload whose stored type does not match its bytes', async () => {
    const upload = uploadedSession([{ name: 'flyer.png', bytes: PDF, contentType: 'image/png' }])
    const result = await createChangeRequest(INITIAL, requestForm(upload))
    expect(result.errors?.attachments?.[0]).toMatch(/not a valid PNG/)
  })

  it('rejects an upload that is really over 10 MB', async () => {
    const upload = uploadedSession([{ name: 'big.png', size: 10 * MB + 1 }])
    const result = await createChangeRequest(INITIAL, requestForm(upload))
    expect(result.errors?.attachments?.[0]).toMatch(/larger than 10 MB/)
    expect(removed).toEqual([upload.paths])
  })

  it('rejects a path that was never uploaded', async () => {
    const upload = uploadedSession([{ name: 'a.png' }])
    storedObjects.clear()
    const result = await createChangeRequest(INITIAL, requestForm(upload))
    expect(result.errors?.attachments?.[0]).toMatch(/did not finish uploading/)
  })

  it('rejects more than five attachments', async () => {
    const upload = uploadedSession(Array.from({ length: 6 }, (_, i) => ({ name: `f${i}.png` })))
    const result = await createChangeRequest(INITIAL, requestForm(upload))
    expect(result.errors?.attachments?.[0]).toMatch(/at most 5/)
    expect(moves).toHaveLength(0)
  })

  it('rolls back moved and pending objects when a move fails', async () => {
    moveFailOn = 1
    const upload = uploadedSession([{ name: 'a.png' }, { name: 'b.png' }])
    const result = await createChangeRequest(INITIAL, requestForm(upload))
    const requestId = (userInserts[0].row as { id: string }).id
    expect(result.message).toMatch(/Nothing was submitted/)
    expect(events).toEqual(['insert:change_requests', 'move'])
    // Guarded delete first; objects only once the row is confirmed gone.
    expect(adminDeletes).toEqual([
      {
        table: 'change_requests',
        filters: [
          ['id', requestId],
          ['status', 'submitting'],
        ],
      },
    ])
    expect(removed).toEqual([[moves[0].to, ...upload.paths]])
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('keeps moved objects when a move fails and the row cannot be confirmed deleted', async () => {
    moveFailOn = 1
    deleteMatches = false
    const upload = uploadedSession([{ name: 'a.png' }, { name: 'b.png' }])
    const result = await createChangeRequest(INITIAL, requestForm(upload))
    expect(result.message).toMatch(/may still be processing/)
    expect(removed).toHaveLength(0)
  })

  it('deletes the request and all objects when recording file rows fails', async () => {
    fileInsertError = { message: 'insert failed' }
    const upload = uploadedSession([{ name: 'a.png' }])
    const result = await createChangeRequest(INITIAL, requestForm(upload))
    const requestId = (userInserts[0].row as { id: string }).id
    expect(result.success).toBe(false)
    expect(adminDeletes).toEqual([
      {
        table: 'change_requests',
        filters: [
          ['id', requestId],
          ['status', 'submitting'],
        ],
      },
    ])
    expect(removed).toEqual([[moves[0].to, ...upload.paths]])
    expect(mockSendEmail).not.toHaveBeenCalled()
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('removes objects when the RLS insert is rejected', async () => {
    userInsertError = { message: 'new row violates row-level security policy' }
    const upload = uploadedSession([{ name: 'a.png' }])
    const result = await createChangeRequest(INITIAL, requestForm(upload))
    expect(result).toEqual({ success: false, message: 'Failed to submit the change request' })
    // Nothing was moved; only the pending uploads are discarded.
    expect(moves).toHaveLength(0)
    expect(removed).toEqual([upload.paths])
  })

  it('rolls everything back and sends no email when the queue flip fails', async () => {
    queueError = { message: 'db down' }
    const upload = uploadedSession([{ name: 'a.png' }])
    const result = await createChangeRequest(INITIAL, requestForm(upload))
    const requestId = (userInserts[0].row as { id: string }).id
    expect(result.message).toMatch(/Nothing was submitted/)
    expect(adminDeletes).toEqual([
      {
        table: 'change_requests',
        filters: [
          ['id', requestId],
          ['status', 'submitting'],
        ],
      },
    ])
    expect(removed).toEqual([[moves[0].to, ...upload.paths]])
    expect(mockSendEmail).not.toHaveBeenCalled()
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('rolls back when the flip matches no row and the re-read shows submitting', async () => {
    requeueMatches = false
    const result = await createChangeRequest(INITIAL, requestForm())
    expect(result.message).toMatch(/Nothing was submitted/)
    expect(adminDeletes).toHaveLength(1)
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it.each(['queued', 'in_progress'])(
    'treats a flip whose response was lost as success when the row is already %s',
    async (status) => {
      queueError = { message: 'socket hang up' }
      rereadRow = { status }
      const upload = uploadedSession([{ name: 'a.png' }])
      const url = await expectRedirect(createChangeRequest(INITIAL, requestForm(upload)))
      expect(url).toMatch(/^\/admin\/requests\//)
      expect(adminDeletes).toHaveLength(0)
      expect(removed).toHaveLength(0)
      expect(mockSendEmail).toHaveBeenCalledTimes(1)
    }
  )

  it('leaves everything alone and says it may still be processing when the state is unknown', async () => {
    queueError = { message: 'socket hang up' }
    rereadError = { message: 'still down' }
    const upload = uploadedSession([{ name: 'a.png' }])
    const result = await createChangeRequest(INITIAL, requestForm(upload))
    expect(result.success).toBe(false)
    expect(result.message).toMatch(/may still be processing/)
    expect(adminDeletes).toHaveLength(0)
    expect(removed).toHaveLength(0)
    expect(mockSendEmail).not.toHaveBeenCalled()
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('keeps the files when the guarded rollback delete removes no row', async () => {
    queueError = { message: 'socket hang up' }
    deleteMatches = false // flipped between the re-read and the delete
    const upload = uploadedSession([{ name: 'a.png' }])
    const result = await createChangeRequest(INITIAL, requestForm(upload))
    expect(result.message).toMatch(/may still be processing/)
    expect(adminDeletes).toHaveLength(1)
    expect(removed).toHaveLength(0)
  })

  it('keeps the files when the rollback delete errors', async () => {
    fileInsertError = { message: 'insert failed' }
    deleteError = { message: 'db down' }
    const upload = uploadedSession([{ name: 'a.png' }])
    const result = await createChangeRequest(INITIAL, requestForm(upload))
    expect(result.message).toMatch(/may still be processing/)
    expect(removed).toHaveLength(0)
  })

  it('removes the files when the row is gone at re-read', async () => {
    queueError = { message: 'socket hang up' }
    rereadRow = null
    const upload = uploadedSession([{ name: 'a.png' }])
    const result = await createChangeRequest(INITIAL, requestForm(upload))
    expect(result.message).toMatch(/Nothing was submitted/)
    expect(adminDeletes).toHaveLength(0)
    expect(removed).toEqual([[moves[0].to, ...upload.paths]])
  })

  it('sends the email only after the request is queued', async () => {
    mockSendEmail.mockImplementation(async () => {
      expect(adminUpdates.some((u) => (u.values as { status?: string }).status === 'queued')).toBe(
        true
      )
      return { data: {}, error: null }
    })
    await expectRedirect(createChangeRequest(INITIAL, requestForm()))
    expect(mockSendEmail).toHaveBeenCalledTimes(1)
  })

  it('wakes the agent only after the completed request is queued', async () => {
    mockTriggerAgent.mockImplementation(async (id: string) => {
      expect(adminUpdates).toContainEqual(expect.objectContaining({ values: { status: 'queued' } }))
      expect(userInserts).toContainEqual(
        expect.objectContaining({
          table: 'change_requests',
          row: expect.objectContaining({ id }),
        })
      )
      return 'accepted'
    })
    const url = await expectRedirect(createChangeRequest(INITIAL, requestForm()))
    expect(mockTriggerAgent).toHaveBeenCalledExactlyOnceWith(url.split('/').pop())
    expect(
      adminUpdates.every((update) => (update.values as { status: string }).status === 'queued')
    ).toBe(true)
  })

  it('does not launch a request whose queue state is unknown or still submitting', async () => {
    queueError = { message: 'connection lost' }
    rereadError = { message: 'offline' }
    await createChangeRequest(INITIAL, requestForm())
    expect(mockTriggerAgent).not.toHaveBeenCalled()
    rereadError = null
    await createChangeRequest(INITIAL, requestForm())
    expect(mockTriggerAgent).not.toHaveBeenCalled()
  })

  it('does not launch again when rereading shows an existing worker claimed it', async () => {
    queueError = { message: 'response lost' }
    rereadRow = { status: 'in_progress' }
    await expectRedirect(createChangeRequest(INITIAL, requestForm()))
    expect(mockTriggerAgent).not.toHaveBeenCalled()
  })

  it('preserves a queued request and records a private retry notice when launch is unconfirmed', async () => {
    mockTriggerAgent.mockResolvedValue('unavailable')
    await expectRedirect(createChangeRequest(INITIAL, requestForm()))
    expect(adminDeletes).toHaveLength(0)
    expect(adminInserts).toContainEqual(
      expect.objectContaining({
        table: 'change_request_messages',
        row: expect.objectContaining({
          author_kind: 'system',
          body: expect.stringContaining('post a reply to retry'),
        }),
      })
    )
  })

  it('still succeeds when the notification email fails', async () => {
    mockSendEmail.mockRejectedValue(new Error('resend down'))
    await expectRedirect(createChangeRequest(INITIAL, requestForm()))
  })

  it('skips the email when CHANGE_REQUEST_NOTIFY_EMAIL is unset', async () => {
    delete process.env.CHANGE_REQUEST_NOTIFY_EMAIL
    await expectRedirect(createChangeRequest(INITIAL, requestForm()))
    expect(mockSendEmail).not.toHaveBeenCalled()
  })
})

// ─── addChangeRequestMessage ─────────────────────────────────────────

function replyForm(body = 'Use the second photo instead.', intent?: string) {
  const formData = new FormData()
  formData.set('request_id', REQUEST_ID)
  formData.set('body', body)
  if (intent) formData.set('intent', intent)
  return formData
}

function rpcReturns(outcome: string, previousStatus: string | null = 'in_progress') {
  mockRpc.mockResolvedValue({
    data: [{ outcome, previous_status: previousStatus, message_id: 'msg-1' }],
    error: null,
  })
}

describe('addChangeRequestMessage', () => {
  beforeEach(() => {
    requestRow = { id: REQUEST_ID, status: 'queued', pr_number: 12 }
  })

  it('rejects a non-admin', async () => {
    profile = null
    const result = await addChangeRequestMessage(INITIAL, replyForm())
    expect(result).toEqual({ success: false, message: 'Forbidden: admin access required' })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('validates the body', async () => {
    const result = await addChangeRequestMessage(INITIAL, replyForm('   '))
    expect(result.errors).toHaveProperty('body')
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('rejects an unknown reply intent', async () => {
    const result = await addChangeRequestMessage(INITIAL, replyForm('Hi', 'merge'))
    expect(result.errors).toHaveProperty('intent')
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('saves the reply and any requeue in one transactional call as the signed-in admin', async () => {
    rpcReturns('posted')
    await addChangeRequestMessage(INITIAL, replyForm('Make it bigger.', 'revision'))
    expect(mockRpc).toHaveBeenCalledExactlyOnceWith('reply_to_change_request', {
      p_request_id: REQUEST_ID,
      p_body: 'Make it bigger.',
      p_intent: 'revision',
    })
  })

  it('defaults to a plain reply', async () => {
    rpcReturns('posted')
    await addChangeRequestMessage(INITIAL, replyForm())
    expect(mockRpc.mock.calls[0][1].p_intent).toBe('reply')
  })

  it('returns not found for an unknown request', async () => {
    rpcReturns('not_found', null)
    const result = await addChangeRequestMessage(INITIAL, replyForm())
    expect(result).toEqual({ success: false, message: 'Change request not found' })
  })

  it('reports a failed save', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const result = await addChangeRequestMessage(INITIAL, replyForm())
    expect(result).toEqual({ success: false, message: 'Failed to post your reply' })
    expect(mockTriggerAgent).not.toHaveBeenCalled()
  })

  it('posts a plain reply without a system message or launch for an in-flight request', async () => {
    rpcReturns('posted', 'in_progress')
    const result = await addChangeRequestMessage(INITIAL, replyForm())
    expect(result).toEqual({ success: true, message: 'Reply posted.' })
    expect(adminInserts).toHaveLength(0)
    expect(mockTriggerAgent).not.toHaveBeenCalled()
  })

  it('retries launch on a reply to a queued request', async () => {
    rpcReturns('posted', 'queued')
    const result = await addChangeRequestMessage(INITIAL, replyForm())
    expect(result).toEqual({ success: true, message: 'Reply posted.' })
    expect(mockTriggerAgent).toHaveBeenCalledExactlyOnceWith(REQUEST_ID)
  })

  it('explains a requeue in the thread and wakes the agent', async () => {
    rpcReturns('requeued', 'needs_attention')
    const result = await addChangeRequestMessage(INITIAL, replyForm('Try again.', 'requeue'))
    expect(result.success).toBe(true)
    expect(result.message).toMatch(/back in the queue/)
    expect(adminInserts).toHaveLength(1)
    expect(adminInserts[0]).toMatchObject({
      table: 'change_request_messages',
      row: { request_id: REQUEST_ID, author_kind: 'system', author_id: null },
    })
    expect((adminInserts[0].row as { body: string }).body).toMatch(/^Requeued after a reply from/)
    expect(mockTriggerAgent).toHaveBeenCalledExactlyOnceWith(REQUEST_ID)
  })

  it('keeps a note on a ready request as a note', async () => {
    rpcReturns('posted', 'ready_for_review')
    const result = await addChangeRequestMessage(INITIAL, replyForm('Looks good.', 'note'))
    expect(result).toEqual({ success: true, message: 'Reply posted.' })
    expect(adminInserts).toHaveLength(0)
    expect(mockTriggerAgent).not.toHaveBeenCalled()
  })

  it('requests changes: explains it with the PR number and wakes the agent', async () => {
    rpcReturns('revision', 'ready_for_review')
    const result = await addChangeRequestMessage(
      INITIAL,
      replyForm('Make the heading bigger.', 'revision')
    )
    expect(result).toEqual({
      success: true,
      message: 'Changes requested. The agent will update the pull request and verify it again.',
    })
    expect((adminInserts[0].row as { body: string }).body).toMatch(
      /^Changes requested by Fr\. Admin\. The agent will revise pull request #12/
    )
    expect(mockTriggerAgent).toHaveBeenCalledExactlyOnceWith(REQUEST_ID)
  })

  it('tells the admin nothing was saved when the request is no longer ready', async () => {
    rpcReturns('stale', 'queued')
    const result = await addChangeRequestMessage(INITIAL, replyForm('Make it blue.', 'revision'))
    expect(result.success).toBe(false)
    expect(result.message).toMatch(/no longer ready for review, so nothing was saved/)
    expect(adminInserts).toHaveLength(0)
    expect(mockTriggerAgent).not.toHaveBeenCalled()
  })
})

// ─── closeChangeRequest ──────────────────────────────────────────────

function closeForm(reason = 'No longer needed.') {
  const formData = new FormData()
  formData.set('request_id', REQUEST_ID)
  formData.set('reason', reason)
  return formData
}

function closeReturns(outcome: string, previousStatus: string | null, cleanupPending = false) {
  mockRpc.mockResolvedValue({
    data: [{ outcome, previous_status: previousStatus, cleanup_pending: cleanupPending }],
    error: null,
  })
}

describe('closeChangeRequest', () => {
  it('rejects a non-admin before touching data', async () => {
    profile = null
    const result = await closeChangeRequest(INITIAL, closeForm())
    expect(result).toEqual({ success: false, message: 'Forbidden: admin access required' })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('requires a reason', async () => {
    const result = await closeChangeRequest(INITIAL, closeForm(' x '))
    expect(result.errors).toHaveProperty('reason')
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('closes atomically as the signed-in admin and wakes the agent to clean up GitHub', async () => {
    closeReturns('closed', 'ready_for_review', true)
    const result = await closeChangeRequest(INITIAL, closeForm('Done another way.'))
    expect(result).toEqual({ success: true, message: 'Request closed.' })
    expect(mockRpc).toHaveBeenCalledExactlyOnceWith('close_change_request', {
      p_request_id: REQUEST_ID,
      p_reason: 'Done another way.',
    })
    expect((adminInserts[0].row as { body: string }).body).toBe(
      'Closed by Fr. Admin. The agent will close any open pull request and delete its branch. Nothing changes on the live site.'
    )
    expect(mockTriggerAgent).toHaveBeenCalledExactlyOnceWith(REQUEST_ID)
  })

  it('does not wake the agent when there is nothing to clean up', async () => {
    closeReturns('closed', 'queued', false)
    const result = await closeChangeRequest(INITIAL, closeForm())
    expect(result.success).toBe(true)
    expect((adminInserts[0].row as { body: string }).body).toBe(
      'Closed by Fr. Admin. Nothing changes on the live site.'
    )
    expect(mockTriggerAgent).not.toHaveBeenCalled()
  })

  it('explains that an in-flight request cannot be closed yet', async () => {
    closeReturns('not_closable', 'in_progress')
    const result = await closeChangeRequest(INITIAL, closeForm())
    expect(result.success).toBe(false)
    expect(result.message).toMatch(/working on this request right now/)
    expect(adminInserts).toHaveLength(0)
    expect(mockTriggerAgent).not.toHaveBeenCalled()
  })

  it('reports a request that is already finished', async () => {
    closeReturns('not_closable', 'merged')
    const result = await closeChangeRequest(INITIAL, closeForm())
    expect(result.message).toMatch(/can no longer be closed/)
  })

  it('reports not found and failures', async () => {
    closeReturns('not_found', null)
    expect(await closeChangeRequest(INITIAL, closeForm())).toEqual({
      success: false,
      message: 'Change request not found',
    })
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect((await closeChangeRequest(INITIAL, closeForm())).message).toMatch(/Could not close/)
  })
})
