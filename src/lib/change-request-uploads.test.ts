import { beforeEach, describe, expect, it } from 'vitest'

import {
  UPLOAD_SESSION_TTL_MS,
  createUploadSession,
  parsePendingUploadPath,
  pendingUploadPath,
  verifyUploadSession,
} from '@/lib/change-request-uploads'

const USER = '550e8400-e29b-41d4-a716-446655440001'
const OTHER = '550e8400-e29b-41d4-a716-446655440002'

beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
})

describe('upload sessions', () => {
  it('verifies a fresh token for the same user and session', () => {
    const session = createUploadSession(USER)
    expect(verifyUploadSession(USER, session.sessionId, session.token)).toBe(true)
  })

  it('rejects another user, another session, tampering, and expiry', () => {
    const now = Date.now()
    const session = createUploadSession(USER, now)
    const other = createUploadSession(USER, now)
    const [expires, sig] = session.token.split('.')

    expect(verifyUploadSession(OTHER, session.sessionId, session.token)).toBe(false)
    expect(verifyUploadSession(USER, other.sessionId, session.token)).toBe(false)
    expect(verifyUploadSession(USER, session.sessionId, `${Number(expires) + 1}.${sig}`)).toBe(
      false
    )
    expect(verifyUploadSession(USER, session.sessionId, `${expires}.${sig}x`)).toBe(false)
    expect(verifyUploadSession(USER, session.sessionId, `${expires}.${sig}.x`)).toBe(false)
    expect(verifyUploadSession(USER, session.sessionId, null)).toBe(false)
    expect(verifyUploadSession(USER, 'not-a-uuid', session.token)).toBe(false)
    expect(
      verifyUploadSession(USER, session.sessionId, session.token, now + UPLOAD_SESSION_TTL_MS + 1)
    ).toBe(false)
  })

  it('tokens stop verifying when the signing key changes', () => {
    const session = createUploadSession(USER)
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'rotated'
    expect(verifyUploadSession(USER, session.sessionId, session.token)).toBe(false)
  })
})

describe('pending upload paths', () => {
  it('round-trips a minted path', () => {
    const { sessionId } = createUploadSession(USER)
    const path = pendingUploadPath(sessionId, 'Feast-Flyer.png')
    const parsed = parsePendingUploadPath(path, sessionId)
    expect(parsed?.filename).toBe('Feast-Flyer.png')
    expect(parsed?.objectName).toBe(path.split('/').pop())
  })

  it('rejects paths from other sessions or with traversal', () => {
    const { sessionId } = createUploadSession(USER)
    const other = createUploadSession(USER).sessionId
    const id = crypto.randomUUID()
    expect(parsePendingUploadPath(`pending/${other}/${id}-a.png`, sessionId)).toBeNull()
    expect(parsePendingUploadPath(`pending/${sessionId}/${id}-../a.png`, sessionId)).toBeNull()
    expect(parsePendingUploadPath(`pending/${sessionId}/a.png`, sessionId)).toBeNull()
    expect(parsePendingUploadPath(`pending/${sessionId}/${id}-a.png/x`, sessionId)).toBeNull()
    expect(parsePendingUploadPath(`requests/${sessionId}/${id}-a.png`, sessionId)).toBeNull()
    expect(parsePendingUploadPath(`pending/.*/${id}-a.png`, '.*')).toBeNull()
  })
})
