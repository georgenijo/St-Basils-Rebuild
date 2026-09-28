import 'server-only'

import { logger } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ChangeRequestFile, ChangeRequestFileWithUrl } from '@/types/change-request'

/** Private Storage bucket; see docs/change-requests.md. */
export const CHANGE_REQUESTS_BUCKET = 'change-requests'

/** Signed URLs are minted per page render, so keep them short-lived. */
export const CHANGE_REQUEST_SIGNED_URL_TTL_SECONDS = 10 * 60

const log = logger.child({ scope: 'change-requests' })

/**
 * Attach a short-lived signed URL to each file row. The bucket has no
 * user-facing policies, so URLs are minted with the service role after the
 * admin layout has already authorized the viewer.
 */
export async function signChangeRequestFiles(
  files: ChangeRequestFile[]
): Promise<ChangeRequestFileWithUrl[]> {
  if (files.length === 0) return []

  try {
    const { data, error } = await createAdminClient()
      .storage.from(CHANGE_REQUESTS_BUCKET)
      .createSignedUrls(
        files.map((file) => file.storage_path),
        CHANGE_REQUEST_SIGNED_URL_TTL_SECONDS
      )

    if (error) {
      log.error('change_request.sign_urls_failed', { error })
      return files.map((file) => ({ ...file, url: null }))
    }

    const urls = new Map<string, string | null>()
    for (const entry of data ?? []) {
      if (entry.path) urls.set(entry.path, entry.error ? null : entry.signedUrl)
    }
    return files.map((file) => ({ ...file, url: urls.get(file.storage_path) ?? null }))
  } catch (error) {
    log.error('change_request.sign_urls_failed', { error })
    return files.map((file) => ({ ...file, url: null }))
  }
}

export interface StoredObjectHead {
  /** Leading bytes of the object (at most `length`). */
  bytes: Uint8Array
  /** Real stored size in bytes. */
  size: number
  contentType: string | null
}

/**
 * Read the first `length` bytes and the real size of a stored object with a
 * ranged service-role request, without downloading the whole file.
 * Returns null when the object does not exist.
 */
export async function readStoredObjectHead(
  path: string,
  length = 32
): Promise<StoredObjectHead | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey)
    throw new Error('Missing Supabase admin environment variables')

  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/authenticated/${CHANGE_REQUESTS_BUCKET}/${encodedPath}`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Range: `bytes=0-${length - 1}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    }
  )

  if (response.status === 400 || response.status === 404) {
    await response.body?.cancel()
    return null
  }
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(`Storage read failed with HTTP ${response.status}`)
  }

  // Content-Range: bytes 0-31/12345 carries the full size for a 206. Storage
  // honours Range, so the body is only `length` bytes; if a server ignored it
  // the bucket's 10 MB cap still bounds the read.
  const range = response.headers.get('content-range')
  const total = range ? Number(range.split('/')[1]) : Number(response.headers.get('content-length'))
  const bytes = new Uint8Array(await response.arrayBuffer()).slice(0, length)

  return {
    bytes,
    size: Number.isFinite(total) ? total : -1,
    contentType: response.headers.get('content-type'),
  }
}

/**
 * Best-effort removal of abandoned direct uploads (the admin closed the tab
 * between uploading and submitting). A pending session is stale once every
 * object in it is older than the upload-session lifetime, after which its
 * token can no longer be submitted anyway.
 */
export async function sweepStalePendingUploads({
  olderThanMs,
  maxSessions = 25,
  now = Date.now(),
}: {
  olderThanMs: number
  maxSessions?: number
  now?: number
}): Promise<number> {
  const storage = createAdminClient().storage.from(CHANGE_REQUESTS_BUCKET)
  const { data: sessions, error } = await storage.list('pending', { limit: maxSessions })
  if (error) {
    log.warn('change_request.pending_sweep_failed', { error })
    return 0
  }

  let removed = 0
  for (const session of sessions ?? []) {
    const folder = `pending/${session.name}`
    const { data: objects } = await storage.list(folder, { limit: 100 })
    if (!objects || objects.length === 0) continue
    const stale = objects.every((object) => {
      const created = Date.parse(object.created_at ?? '')
      return Number.isFinite(created) && now - created > olderThanMs
    })
    if (!stale) continue
    const { error: removeError } = await storage.remove(
      objects.map((object) => `${folder}/${object.name}`)
    )
    if (removeError) {
      log.warn('change_request.pending_sweep_failed', { error: removeError, folder })
    } else {
      removed += objects.length
    }
  }
  return removed
}

/**
 * Best-effort removal of requests stuck in `submitting` (the submission died
 * between inserting the row and flipping it to `queued`). Their objects are
 * removed first (recorded file rows plus anything already moved into the
 * request folder), then the rows; files and messages cascade.
 */
export async function sweepAbandonedSubmissions({
  olderThanMs,
  maxRequests = 25,
  now = Date.now(),
}: {
  olderThanMs: number
  maxRequests?: number
  now?: number
}): Promise<number> {
  const admin = createAdminClient()
  const cutoff = new Date(now - olderThanMs).toISOString()
  const { data: requests, error } = await admin
    .from('change_requests')
    .select('id')
    .eq('status', 'submitting')
    .lt('created_at', cutoff)
    .limit(maxRequests)

  if (error) {
    log.warn('change_request.submitting_sweep_failed', { error })
    return 0
  }

  const storage = admin.storage.from(CHANGE_REQUESTS_BUCKET)
  let removed = 0
  for (const { id } of (requests ?? []) as { id: string }[]) {
    const { data: fileRows } = await admin
      .from('change_request_files')
      .select('storage_path')
      .eq('request_id', id)
    const folder = `requests/${id}/attachments`
    const { data: objects } = await storage.list(folder, { limit: 100 })
    const paths = Array.from(
      new Set([
        ...((fileRows ?? []) as { storage_path: string }[]).map((row) => row.storage_path),
        ...(objects ?? []).map((object) => `${folder}/${object.name}`),
      ])
    )
    if (paths.length > 0) {
      const { error: removeError } = await storage.remove(paths)
      if (removeError) {
        log.warn('change_request.submitting_sweep_failed', { error: removeError, requestId: id })
        continue
      }
    }

    // Only delete if it is still abandoned (never flipped meanwhile).
    const { error: deleteError } = await admin
      .from('change_requests')
      .delete()
      .eq('id', id)
      .eq('status', 'submitting')
    if (deleteError) {
      log.warn('change_request.submitting_sweep_failed', { error: deleteError, requestId: id })
    } else {
      removed += 1
    }
  }
  return removed
}
