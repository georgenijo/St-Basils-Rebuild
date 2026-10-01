export type ChangeRequestStatus =
  | 'submitting'
  | 'queued'
  | 'in_progress'
  | 'verifying'
  | 'ready_for_review'
  | 'needs_attention'
  | 'merged'
  | 'closed'

export type Verdict = 'pass' | 'fail' | 'unsure'

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
  verification: VerificationResult | null
  /** Verified commit a requested revision builds on (set by the site's "Request changes"). */
  revision_base_sha: string | null
  claimed_by: string | null
  claimed_at: string | null
  attempts: number
  error: string | null
  created_at: string
  updated_at: string
}

export interface ChangeRequestMessage {
  id: string
  request_id: string
  author_kind: 'requester' | 'agent' | 'system'
  author_id: string | null
  body: string
  /** Requester replies: `note` is not an instruction; `revision` asks for changes. */
  intent?: 'note' | 'revision' | null
  created_at: string
}

export interface ChangeRequestFile {
  id: string
  request_id: string
  kind: 'attachment' | 'verification'
  storage_path: string
  filename: string
  content_type: string
  size_bytes: number
  label: string | null
  created_at: string
}

export interface VerificationCheck {
  name: string
  ok: boolean
  detail?: string
}

export interface VerificationResult {
  verdict: Verdict
  summary: string
  checks: VerificationCheck[]
  /** Commit the verified preview deployment was built from. */
  commit_sha: string | null
}

/** An attachment copied into the checkout for the agent to reference. */
export interface PlacedAttachment {
  filename: string
  /** Repo-relative path, e.g. public/images/requests/abcd1234/photo.jpg */
  repoPath: string
  /** Public URL path, e.g. /images/requests/abcd1234/photo.jpg */
  publicPath: string
  contentType: string
}
