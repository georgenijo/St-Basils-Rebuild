'use server'

import { createClient } from '@/lib/supabase/server'

export interface ChangeRequestLiveState {
  status: string
  updatedAt: string
  messageCount: number
  fileCount: number
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * A small fingerprint of a request, polled by the request page while the
 * agent works so it only re-renders when something actually changed.
 * Read-only and RLS-scoped: non-admins (and unknown ids) get null.
 */
export async function getChangeRequestLiveState(
  id: string
): Promise<ChangeRequestLiveState | null> {
  if (typeof id !== 'string' || !UUID_PATTERN.test(id)) return null
  const supabase = await createClient()
  const [request, messages, files] = await Promise.all([
    supabase.from('change_requests').select('status, updated_at').eq('id', id).maybeSingle(),
    supabase
      .from('change_request_messages')
      .select('id', { count: 'exact', head: true })
      .eq('request_id', id),
    // Verification screenshots/recordings arrive without touching the request row.
    supabase
      .from('change_request_files')
      .select('id', { count: 'exact', head: true })
      .eq('request_id', id),
  ])
  if (!request.data) return null
  return {
    status: request.data.status,
    updatedAt: request.data.updated_at,
    messageCount: messages.count ?? 0,
    fileCount: files.count ?? 0,
  }
}
