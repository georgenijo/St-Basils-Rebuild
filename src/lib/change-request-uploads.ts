import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Direct-to-Storage upload sessions for change-request attachments.
 *
 * The browser uploads files straight to Storage through signed upload URLs
 * (Vercel caps function request bodies at 4.5 MB, so file bytes never pass
 * through a server action). Each batch of uploads lives under
 * `pending/<session id>/`. The session id is bound to the admin who minted it
 * with an HMAC token, so `createChangeRequest` only ever adopts objects from a
 * prefix it handed to that same user, and only while the token is fresh.
 */

export const PENDING_UPLOAD_PREFIX = 'pending'

/** Signed upload URLs are valid for 2 hours; sessions expire with them. */
export const UPLOAD_SESSION_TTL_MS = 2 * 60 * 60 * 1000

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const UUID_PATTERN = new RegExp(`^${UUID}$`)
const SAFE_NAME = '[A-Za-z0-9_-]+\\.[a-z]+'

function signingKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY for upload session signing')
  return key
}

function signature(userId: string, sessionId: string, expiresAt: number): string {
  return createHmac('sha256', signingKey())
    .update(`change-request-upload:v1:${userId}:${sessionId}:${expiresAt}`)
    .digest('base64url')
}

export interface UploadSession {
  sessionId: string
  token: string
  expiresAt: number
}

export function createUploadSession(userId: string, now = Date.now()): UploadSession {
  const sessionId = crypto.randomUUID()
  const expiresAt = now + UPLOAD_SESSION_TTL_MS
  return { sessionId, expiresAt, token: `${expiresAt}.${signature(userId, sessionId, expiresAt)}` }
}

/** True only for an unexpired token minted for this user and session. */
export function verifyUploadSession(
  userId: string,
  sessionId: unknown,
  token: unknown,
  now = Date.now()
): sessionId is string {
  if (typeof sessionId !== 'string' || typeof token !== 'string') return false
  if (!UUID_PATTERN.test(sessionId)) return false

  const [expiresRaw, provided, ...rest] = token.split('.')
  if (!expiresRaw || !provided || rest.length > 0 || !/^\d+$/.test(expiresRaw)) return false
  const expiresAt = Number(expiresRaw)
  if (!Number.isSafeInteger(expiresAt) || expiresAt < now) return false

  const expected = Buffer.from(signature(userId, sessionId, expiresAt))
  const actual = Buffer.from(provided)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export function pendingSessionFolder(sessionId: string): string {
  return `${PENDING_UPLOAD_PREFIX}/${sessionId}`
}

export function pendingUploadPath(sessionId: string, filename: string): string {
  return `${pendingSessionFolder(sessionId)}/${crypto.randomUUID()}-${filename}`
}

/**
 * Parse `pending/<sessionId>/<uuid>-<safe name>`; returns the object key
 * inside the session folder and the filename, or null for anything else.
 */
export function parsePendingUploadPath(
  path: string,
  sessionId: string
): { objectName: string; filename: string } | null {
  if (!UUID_PATTERN.test(sessionId)) return null
  const match = new RegExp(
    `^${PENDING_UPLOAD_PREFIX}/${sessionId}/((${UUID})-(${SAFE_NAME}))$`
  ).exec(path)
  if (!match) return null
  return { objectName: match[1], filename: match[3] }
}
