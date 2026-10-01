import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { CleanupDeps, StoredObject } from './abandoned'
import type { Config } from './config'
import { log } from './log'
import type {
  ChangeRequest,
  ChangeRequestFile,
  ChangeRequestMessage,
  ChangeRequestStatus,
  VerificationResult,
} from './types'

export const BUCKET = 'change-requests'
const MAX_BODY = 5000

export type Db = SupabaseClient

export function createDb(config: Config): Db {
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function claimNext(db: Db, workerId: string): Promise<ChangeRequest | null> {
  const { data, error } = await db.rpc('claim_next_change_request', { worker_id: workerId })
  if (error) throw new Error(`claim_next_change_request failed: ${error.message}`)
  const rows = (data ?? []) as ChangeRequest[]
  return rows[0] ?? null
}

export async function getRequest(db: Db, id: string): Promise<ChangeRequest> {
  const { data, error } = await db.from('change_requests').select('*').eq('id', id).single()
  if (error) throw new Error(`Loading request ${id} failed: ${error.message}`)
  return data as ChangeRequest
}

export async function getMessages(db: Db, id: string): Promise<ChangeRequestMessage[]> {
  const { data, error } = await db
    .from('change_request_messages')
    .select('*')
    .eq('request_id', id)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`Loading messages for ${id} failed: ${error.message}`)
  return (data ?? []) as ChangeRequestMessage[]
}

export async function getFiles(
  db: Db,
  id: string,
  kind: ChangeRequestFile['kind']
): Promise<ChangeRequestFile[]> {
  const { data, error } = await db
    .from('change_request_files')
    .select('*')
    .eq('request_id', id)
    .eq('kind', kind)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`Loading files for ${id} failed: ${error.message}`)
  return (data ?? []) as ChangeRequestFile[]
}

export interface RequestPatch {
  status?: ChangeRequestStatus
  branch_name?: string | null
  pr_number?: number | null
  pr_url?: string | null
  preview_url?: string | null
  verification?: VerificationResult | null
  claimed_by?: string | null
  claimed_at?: string | null
  error?: string | null
  github_cleanup_pending?: boolean
  live_at?: string | null
  live_check_failed_at?: string | null
}

export async function updateRequest(db: Db, id: string, patch: RequestPatch): Promise<void> {
  const { error } = await db.from('change_requests').update(patch).eq('id', id)
  if (error) throw new Error(`Updating request ${id} failed: ${error.message}`)
}

export async function postMessage(
  db: Db,
  id: string,
  authorKind: 'agent' | 'system',
  body: string
): Promise<void> {
  const trimmed = body.trim() || '(empty)'
  const text = trimmed.length > MAX_BODY ? `${trimmed.slice(0, MAX_BODY - 1)}…` : trimmed
  const { error } = await db
    .from('change_request_messages')
    .insert({ request_id: id, author_kind: authorKind, author_id: null, body: text })
  if (error) throw new Error(`Posting message on ${id} failed: ${error.message}`)
}

/** Best-effort message: never throws (used on failure paths). */
export async function postMessageSafe(
  db: Db,
  id: string,
  authorKind: 'agent' | 'system',
  body: string
): Promise<void> {
  try {
    await postMessage(db, id, authorKind, body)
  } catch (error) {
    log.error('post message failed', { requestId: id, error })
  }
}

export async function downloadFile(db: Db, storagePath: string): Promise<Buffer> {
  const { data, error } = await db.storage.from(BUCKET).download(storagePath)
  if (error || !data)
    throw new Error(`Downloading ${storagePath} failed: ${error?.message ?? 'no data'}`)
  return Buffer.from(await data.arrayBuffer())
}

/**
 * Upload one verification artifact (screenshot or, since content_type is
 * caller-supplied, the private preview recording added alongside them) and
 * record its file row. Both kinds stay `kind: 'verification'`: they are
 * distinguished by content_type/label, not by a separate enum value, so no
 * schema (CHECK constraint) change was needed to add recordings.
 */
export async function uploadVerificationShot(
  db: Db,
  requestId: string,
  storagePath: string,
  filename: string,
  label: string,
  data: Buffer,
  contentType = 'image/png'
): Promise<void> {
  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(storagePath, data, { contentType, upsert: true })
  if (uploadError) throw new Error(`Uploading ${storagePath} failed: ${uploadError.message}`)

  // Re-runs overwrite the object; keep exactly one row per storage path.
  const { error: deleteError } = await db
    .from('change_request_files')
    .delete()
    .eq('storage_path', storagePath)
  if (deleteError)
    throw new Error(`Replacing file row ${storagePath} failed: ${deleteError.message}`)

  const { error } = await db.from('change_request_files').insert({
    request_id: requestId,
    kind: 'verification',
    storage_path: storagePath,
    filename,
    content_type: contentType,
    size_bytes: data.length,
    label,
  })
  if (error) throw new Error(`Recording ${storagePath} failed: ${error.message}`)
}

export async function listByStatus(
  db: Db,
  statuses: ChangeRequestStatus[]
): Promise<ChangeRequest[]> {
  const { data, error } = await db.from('change_requests').select('*').in('status', statuses)
  if (error) throw new Error(`Listing requests failed: ${error.message}`)
  return (data ?? []) as ChangeRequest[]
}

/**
 * Record a merged PR (status, merge commit and thread entry in one
 * transaction; idempotent). Returns false if it was already recorded.
 */
export async function recordMerge(
  db: Db,
  id: string,
  mergeCommitSha: string,
  headSha: string | null
): Promise<boolean> {
  const { data, error } = await db.rpc('record_change_request_merge', {
    p_request_id: id,
    p_merge_sha: mergeCommitSha,
    p_head_sha: headSha,
  })
  if (error) throw new Error(`Recording the merge of ${id} failed: ${error.message}`)
  return data === true
}

/**
 * Give an unconfirmed Approve & merge reservation back to ready_for_review:
 * only that reservation (`approvalId`), and with `olderThan` (a Postgres
 * interval) only if it is at least that old, checked in the same transaction.
 */
export async function releaseMerge(
  db: Db,
  id: string,
  approvalId: string,
  reason: string,
  olderThan: string | null = null
): Promise<boolean> {
  const { data, error } = await db.rpc('release_change_request_merge', {
    p_request_id: id,
    p_approval_id: approvalId,
    p_reason: reason,
    p_older_than: olderThan,
  })
  if (error) throw new Error(`Releasing the merge of ${id} failed: ${error.message}`)
  return data === true
}

/** Merged requests whose live deployment has not been confirmed or reported yet. */
export async function listMergedAwaitingLive(db: Db): Promise<ChangeRequest[]> {
  const { data, error } = await db
    .from('change_requests')
    .select('*')
    .eq('status', 'merged')
    .not('merge_commit_sha', 'is', null)
    .is('live_check_failed_at', null)
    .order('merged_at', { ascending: true })
    .limit(20)
  if (error) throw new Error(`Listing merged requests failed: ${error.message}`)
  return (data ?? []) as ChangeRequest[]
}

/** Requests an admin closed whose pull request and branch still need closing on GitHub. */
export async function listClosedPendingCleanup(db: Db): Promise<ChangeRequest[]> {
  const { data, error } = await db
    .from('change_requests')
    .select('*')
    .eq('status', 'closed')
    .eq('github_cleanup_pending', true)
    .order('updated_at', { ascending: true })
    .limit(50)
  if (error) throw new Error(`Listing closed requests failed: ${error.message}`)
  return (data ?? []) as ChangeRequest[]
}

/**
 * Conditional update used by recovery and PR sync so a request that changed
 * underneath us (e.g. requester requeued it) is left alone.
 */
export async function updateIfStatus(
  db: Db,
  id: string,
  expected: ChangeRequestStatus,
  patch: RequestPatch
): Promise<boolean> {
  const { data, error } = await db
    .from('change_requests')
    .update(patch)
    .eq('id', id)
    .eq('status', expected)
    .select('id')
  if (error) throw new Error(`Updating request ${id} failed: ${error.message}`)
  return (data ?? []).length > 0
}

/**
 * Remove every verification screenshot (Storage objects and file rows) for a
 * request, so a retry never shows screenshots of an older revision.
 */
export async function deleteVerificationFiles(db: Db, requestId: string): Promise<number> {
  const rows = await getFiles(db, requestId, 'verification')
  const prefix = `requests/${requestId}/verification`
  const { data: listed, error: listError } = await db.storage
    .from(BUCKET)
    .list(prefix, { limit: 1000 })
  if (listError) throw new Error(`Listing ${prefix} failed: ${listError.message}`)
  const paths = new Set<string>(rows.map((row) => row.storage_path))
  for (const object of listed ?? []) paths.add(`${prefix}/${object.name}`)
  if (paths.size > 0) {
    const { error } = await db.storage.from(BUCKET).remove([...paths])
    if (error) throw new Error(`Removing old verification files failed: ${error.message}`)
  }
  const { error } = await db
    .from('change_request_files')
    .delete()
    .eq('request_id', requestId)
    .eq('kind', 'verification')
  if (error) throw new Error(`Deleting verification file rows failed: ${error.message}`)
  return paths.size
}

/** Every object under `prefix`, recursively (Storage list is one level; folders have id null). */
export async function listObjectsRecursive(db: Db, prefix: string): Promise<StoredObject[]> {
  const out: StoredObject[] = []
  const pending = [prefix.replace(/\/+$/, '')]
  while (pending.length > 0) {
    const dir = pending.pop() as string
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.storage.from(BUCKET).list(dir, { limit: 1000, offset })
      if (error) throw new Error(`Listing ${dir} failed: ${error.message}`)
      const entries = data ?? []
      for (const entry of entries) {
        if (entry.id === null) pending.push(`${dir}/${entry.name}`)
        else out.push({ path: `${dir}/${entry.name}`, createdAt: entry.created_at ?? null })
      }
      if (entries.length < 1000) break
    }
  }
  return out
}

export function cleanupDeps(db: Db): CleanupDeps {
  return {
    async listStale(cutoffIso) {
      const { data, error } = await db
        .from('change_requests')
        .select('id')
        .eq('status', 'submitting')
        .lt('created_at', cutoffIso)
        .limit(100)
      if (error) throw new Error(`Listing abandoned submissions failed: ${error.message}`)
      return (data ?? []).map((row) => row.id as string)
    },
    async deleteIfSubmitting(id) {
      const { data, error } = await db
        .from('change_requests')
        .delete()
        .eq('id', id)
        .eq('status', 'submitting')
        .select('id')
      if (error) throw new Error(`Deleting abandoned submission ${id} failed: ${error.message}`)
      return (data ?? []).length > 0
    },
    listObjects: (prefix) => listObjectsRecursive(db, prefix),
    async removeObjects(paths) {
      for (let i = 0; i < paths.length; i += 500) {
        const { error } = await db.storage.from(BUCKET).remove(paths.slice(i, i + 500))
        if (error) throw new Error(`Removing objects failed: ${error.message}`)
      }
    },
    async listRequestFolders(offset, limit) {
      const { data, error } = await db.storage.from(BUCKET).list('requests', { limit, offset })
      if (error) throw new Error(`Listing requests/ failed: ${error.message}`)
      // Unfiltered so page length drives pagination; non-UUID names are ignored by the sweep.
      return (data ?? []).map((entry) => entry.name)
    },
    async existingRequestIds(ids) {
      if (ids.length === 0) return new Set()
      const { data, error } = await db.from('change_requests').select('id').in('id', ids)
      if (error) throw new Error(`Looking up request rows failed: ${error.message}`)
      return new Set((data ?? []).map((row) => row.id as string))
    },
  }
}
