import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks ---

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: mockFrom,
    })
  ),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { buyShares, markSharesPaid } from '@/actions/shares'

// --- Helpers ---

const MEMBER_ID = '550e8400-e29b-41d4-a716-446655440001'
const ADMIN_ID = '550e8400-e29b-41d4-a716-446655440002'
const FAMILY_ID = '550e8400-e29b-41d4-a716-446655440003'
const SHARE_ID_1 = '550e8400-e29b-41d4-a716-446655440010'
const SHARE_ID_2 = '550e8400-e29b-41d4-a716-446655440011'
const INITIAL_STATE = { success: false, message: '' }

function makeFormData(entries: Record<string, string | string[]>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(entries)) {
    if (Array.isArray(v)) {
      for (const item of v) fd.append(k, item)
    } else {
      fd.append(k, v)
    }
  }
  return fd
}

// --- buyShares ---

describe('buyShares', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns validation errors for empty names', async () => {
    const fd = makeFormData({ names: '[]', year: '2026' })
    const result = await buyShares(INITIAL_STATE, fd)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Validation failed')
    expect(result.errors).toBeDefined()
  })

  it('returns validation errors for missing year', async () => {
    const fd = makeFormData({ names: '["George Thomas"]' })
    const result = await buyShares(INITIAL_STATE, fd)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Validation failed')
  })

  it('returns Unauthorized when no user session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const fd = makeFormData({ names: '["George Thomas"]', year: '2026' })
    const result = await buyShares(INITIAL_STATE, fd)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Unauthorized')
  })

  it('returns error when user has no family', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: MEMBER_ID } } })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { family_id: null }, error: null }),
            }),
          }),
        }
      }
      return {}
    })

    const fd = makeFormData({ names: '["George Thomas"]', year: '2026' })
    const result = await buyShares(INITIAL_STATE, fd)

    expect(result.success).toBe(false)
    expect(result.message).toBe('You must belong to a family to purchase shares')
  })

  it('inserts shares successfully for multiple names', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: MEMBER_ID } } })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { family_id: FAMILY_ID }, error: null }),
            }),
          }),
        }
      }
      if (table === 'shares') {
        return {
          insert: (rows: unknown[]) => {
            expect(rows).toHaveLength(2)
            return Promise.resolve({ error: null })
          },
        }
      }
      return {}
    })

    const fd = makeFormData({
      names: '["George Thomas", "Mary Thomas"]',
      year: '2026',
    })
    const result = await buyShares(INITIAL_STATE, fd)

    expect(result.success).toBe(true)
    expect(result.message).toBe('2 share(s) purchased successfully')
  })

  it('handles duplicate constraint violation', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: MEMBER_ID } } })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { family_id: FAMILY_ID }, error: null }),
            }),
          }),
        }
      }
      if (table === 'shares') {
        return {
          insert: () => Promise.resolve({ error: { code: '23505', message: 'duplicate key' } }),
        }
      }
      return {}
    })

    const fd = makeFormData({ names: '["George Thomas"]', year: '2026' })
    const result = await buyShares(INITIAL_STATE, fd)

    expect(result.success).toBe(false)
    expect(result.message).toBe('One or more names already have shares for this year')
  })

  it('accepts names via repeated form fields', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: MEMBER_ID } } })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { family_id: FAMILY_ID }, error: null }),
            }),
          }),
        }
      }
      if (table === 'shares') {
        return {
          insert: (rows: unknown[]) => {
            expect(rows).toHaveLength(2)
            return Promise.resolve({ error: null })
          },
        }
      }
      return {}
    })

    const fd = makeFormData({
      names: ['George Thomas', 'Mary Thomas'],
      year: '2026',
    })
    const result = await buyShares(INITIAL_STATE, fd)

    expect(result.success).toBe(true)
  })
})

// --- markSharesPaid ---

describe('markSharesPaid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns validation errors for missing share_ids', async () => {
    const fd = makeFormData({ share_ids: '[]', method: 'cash' })
    const result = await markSharesPaid(INITIAL_STATE, fd)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Validation failed')
  })

  it('returns validation errors for invalid method', async () => {
    const fd = makeFormData({ share_ids: `["${SHARE_ID_1}"]`, method: 'bitcoin' })
    const result = await markSharesPaid(INITIAL_STATE, fd)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Validation failed')
  })

  it('returns Unauthorized when no user session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const fd = makeFormData({ share_ids: `["${SHARE_ID_1}"]`, method: 'cash' })
    const result = await markSharesPaid(INITIAL_STATE, fd)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Unauthorized')
  })

  it('returns Forbidden when caller is not admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: MEMBER_ID } } })
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { role: 'member' }, error: null }),
        }),
      }),
    })

    const fd = makeFormData({ share_ids: `["${SHARE_ID_1}"]`, method: 'cash' })
    const result = await markSharesPaid(INITIAL_STATE, fd)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Forbidden: admin access required')
  })

  it('returns error when shares not found', async () => {
    let profileCallCount = 0
    mockGetUser.mockResolvedValue({ data: { user: { id: ADMIN_ID } } })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        profileCallCount++
        if (profileCallCount === 1) {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { role: 'admin' }, error: null }),
              }),
            }),
          }
        }
      }
      if (table === 'shares') {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: [], error: null }),
          }),
        }
      }
      return {}
    })

    const fd = makeFormData({ share_ids: `["${SHARE_ID_1}"]`, method: 'cash' })
    const result = await markSharesPaid(INITIAL_STATE, fd)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Failed to find the specified shares')
  })

  it('returns error when shares already paid', async () => {
    let profileCallCount = 0
    mockGetUser.mockResolvedValue({ data: { user: { id: ADMIN_ID } } })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        profileCallCount++
        if (profileCallCount === 1) {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { role: 'admin' }, error: null }),
              }),
            }),
          }
        }
      }
      if (table === 'shares') {
        return {
          select: () => ({
            in: () =>
              Promise.resolve({
                data: [{ id: SHARE_ID_1, family_id: FAMILY_ID, amount: 50, paid: true }],
                error: null,
              }),
          }),
        }
      }
      return {}
    })

    const fd = makeFormData({ share_ids: `["${SHARE_ID_1}"]`, method: 'cash' })
    const result = await markSharesPaid(INITIAL_STATE, fd)

    expect(result.success).toBe(false)
    expect(result.message).toBe('1 share(s) are already marked as paid')
  })

  it('marks shares as paid and creates payment records', async () => {
    let profileCallCount = 0
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({
      in: () => Promise.resolve({ error: null }),
    })

    mockGetUser.mockResolvedValue({ data: { user: { id: ADMIN_ID } } })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        profileCallCount++
        if (profileCallCount === 1) {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { role: 'admin' }, error: null }),
              }),
            }),
          }
        }
      }
      if (table === 'shares') {
        return {
          select: () => ({
            in: () =>
              Promise.resolve({
                data: [
                  { id: SHARE_ID_1, family_id: FAMILY_ID, amount: 50, paid: false },
                  { id: SHARE_ID_2, family_id: FAMILY_ID, amount: 50, paid: false },
                ],
                error: null,
              }),
          }),
          update: mockUpdate,
        }
      }
      if (table === 'payments') {
        return { insert: mockInsert }
      }
      return {}
    })

    const fd = makeFormData({
      share_ids: `["${SHARE_ID_1}", "${SHARE_ID_2}"]`,
      method: 'check',
      note: 'Paid by check #1234',
    })
    const result = await markSharesPaid(INITIAL_STATE, fd)

    expect(result.success).toBe(true)
    expect(result.message).toBe('2 share(s) marked as paid')
    expect(mockUpdate).toHaveBeenCalledWith({ paid: true })
    expect(mockInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          family_id: FAMILY_ID,
          type: 'share',
          amount: 50,
          method: 'check',
          related_share_id: SHARE_ID_1,
          recorded_by: ADMIN_ID,
        }),
      ])
    )
  })
})
