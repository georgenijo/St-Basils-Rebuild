// Row shapes for the website change-request tables. See docs/change-requests.md
// and supabase/migrations/20260928000000_create_change_requests.sql.

export const CHANGE_REQUEST_STATUSES = [
  'submitting',
  'queued',
  'in_progress',
  'verifying',
  'ready_for_review',
  'needs_attention',
  'merged',
  'closed',
] as const

export type ChangeRequestStatus = (typeof CHANGE_REQUEST_STATUSES)[number]

export type ChangeRequestVerdict = 'pass' | 'fail' | 'unsure'

export interface ChangeRequestVerification {
  verdict: ChangeRequestVerdict
  summary?: string | null
  /** Commit the verified preview was built from. */
  commit_sha?: string | null
  /** Worker-defined; rendered defensively (strings or objects). */
  checks?: unknown
}

export interface ChangeRequest {
  id: string
  requester_id: string
  title: string
  description: string
  page_path: string
  target_selector: string | null
  target_text: string | null
  status: ChangeRequestStatus
  branch_name: string | null
  pr_number: number | null
  pr_url: string | null
  preview_url: string | null
  verification: ChangeRequestVerification | null
  /** Verified commit a requested revision builds on (set by "Request changes"). */
  revision_base_sha: string | null
  claimed_by: string | null
  claimed_at: string | null
  attempts: number
  error: string | null
  created_at: string
  updated_at: string
}

export type ChangeRequestMessageAuthorKind = 'requester' | 'agent' | 'system'

export interface ChangeRequestMessage {
  id: string
  request_id: string
  author_kind: ChangeRequestMessageAuthorKind
  author_id: string | null
  body: string
  /** Requester replies: `note` is not an instruction; `revision` asks for changes. */
  intent?: 'note' | 'revision' | null
  created_at: string
}

export type ChangeRequestFileKind = 'attachment' | 'verification'

export interface ChangeRequestFile {
  id: string
  request_id: string
  kind: ChangeRequestFileKind
  storage_path: string
  filename: string
  content_type: string
  size_bytes: number
  label: string | null
  created_at: string
}

/** A file row plus a short-lived signed URL minted server-side. */
export interface ChangeRequestFileWithUrl extends ChangeRequestFile {
  url: string | null
}
