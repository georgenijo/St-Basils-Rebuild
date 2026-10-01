import type { SupabaseClient } from '@supabase/supabase-js'

import { fetchPeopleNames } from '@/lib/change-request-people'
import type {
  ChangeRequest,
  ChangeRequestFile,
  ChangeRequestFileWithUrl,
  ChangeRequestMessage,
} from '@/types/change-request'

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function formatChangeRequestDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  })
}

/** Image types the thumbnail route can shrink (attachments and agent screenshots). */
export const THUMBNAIL_CONTENT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
])

/** Small cached preview served by the thumbnail route (images only). */
export function changeRequestThumbnailPath(file: Pick<ChangeRequestFile, 'id' | 'request_id'>) {
  return `/admin/requests/${file.request_id}/files/${file.id}/thumbnail`
}

export const CHANGE_REQUEST_DETAIL_COLUMNS =
  'id, requester_id, title, description, page_path, target_selector, target_text, status, branch_name, pr_number, pr_url, preview_url, verification, attempts, error, created_at, updated_at'

/**
 * In-flight reads for the request detail page. Every query starts at once;
 * the page awaits only `request` for the header and streams the rest through
 * Suspense, so the slowest read never blocks first paint.
 */
export interface ChangeRequestDetailData {
  request: Promise<ChangeRequest | null>
  messages: Promise<ChangeRequestMessage[]>
  /** File rows with signed URLs (signing starts as soon as the rows arrive). */
  files: Promise<ChangeRequestFileWithUrl[]>
  /** Display names for the requester and every message author (one query). */
  names: Promise<Map<string, string>>
}

export function loadChangeRequestDetail(
  supabase: Pick<SupabaseClient, 'from'>,
  id: string,
  signFiles: (files: ChangeRequestFile[]) => Promise<ChangeRequestFileWithUrl[]>
): ChangeRequestDetailData {
  const request = Promise.resolve(
    supabase
      .from('change_requests')
      .select(CHANGE_REQUEST_DETAIL_COLUMNS)
      .eq('id', id)
      .maybeSingle()
  ).then(({ data }) => (data ?? null) as ChangeRequest | null)

  const messages = Promise.resolve(
    supabase
      .from('change_request_messages')
      .select('id, request_id, author_kind, author_id, body, intent, created_at')
      .eq('request_id', id)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
  ).then(({ data }) => (data ?? []) as ChangeRequestMessage[])

  const files = Promise.resolve(
    supabase
      .from('change_request_files')
      .select(
        'id, request_id, kind, storage_path, filename, content_type, size_bytes, label, created_at'
      )
      .eq('request_id', id)
      .order('created_at', { ascending: true })
  ).then(({ data }) => signFiles((data ?? []) as ChangeRequestFile[]))

  const names = Promise.all([request, messages]).then(([row, thread]) =>
    fetchPeopleNames(supabase, [row?.requester_id, ...thread.map((message) => message.author_id)])
  )

  // Streamed sections may never consume a read (e.g. notFound() for a missing
  // request), so mark each as handled to avoid unhandled-rejection noise.
  // Consumers still see the original rejection through their own await.
  for (const promise of [request, messages, files, names]) promise.catch(() => {})

  return { request, messages, files, names }
}
