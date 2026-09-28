-- Migration: Website change requests
--
-- Submission is two-phase: the admin inserts the request as 'submitting',
-- the server records attachment rows, then the service role flips it to
-- 'queued'. Only 'queued' rows are claimable, so the worker never sees a
-- half-recorded request.
--
-- Admins submit change requests from /admin/requests. The change-request-agent
-- worker (service role) claims them, opens a PR, verifies the Vercel preview,
-- and reports back. See docs/change-requests.md.

-- ─── change_requests ─────────────────────────────────────────────────

CREATE TABLE public.change_requests (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id    UUID NOT NULL REFERENCES auth.users(id),
  title           TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description     TEXT NOT NULL CHECK (char_length(description) BETWEEN 10 AND 5000),
  page_path       TEXT NOT NULL CHECK (page_path ~ '^/(?!/)[A-Za-z0-9/_.~-]*$' AND char_length(page_path) <= 300),
  target_selector TEXT CHECK (char_length(target_selector) <= 1000),
  target_text     TEXT CHECK (char_length(target_text) <= 500),
  status          TEXT NOT NULL DEFAULT 'submitting' CHECK (status IN (
                    'submitting', 'queued', 'in_progress', 'verifying', 'ready_for_review',
                    'needs_attention', 'merged', 'closed'
                  )),
  branch_name     TEXT,
  pr_number       INTEGER,
  pr_url          TEXT,
  preview_url     TEXT,
  verification    JSONB,
  claimed_by      TEXT,
  claimed_at      TIMESTAMPTZ,
  attempts        INTEGER NOT NULL DEFAULT 0,
  error           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_change_requests_status_created ON public.change_requests(status, created_at);
CREATE INDEX idx_change_requests_created_at ON public.change_requests(created_at DESC);

CREATE TRIGGER set_change_requests_updated_at
  BEFORE UPDATE ON public.change_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── change_request_messages ─────────────────────────────────────────

CREATE TABLE public.change_request_messages (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id  UUID NOT NULL REFERENCES public.change_requests(id) ON DELETE CASCADE,
  author_kind TEXT NOT NULL CHECK (author_kind IN ('requester', 'agent', 'system')),
  author_id   UUID REFERENCES auth.users(id),
  body        TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_change_request_messages_request ON public.change_request_messages(request_id, created_at);

-- ─── change_request_files ────────────────────────────────────────────

CREATE TABLE public.change_request_files (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id   UUID NOT NULL REFERENCES public.change_requests(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('attachment', 'verification')),
  storage_path TEXT NOT NULL UNIQUE,
  filename     TEXT NOT NULL CHECK (char_length(filename) BETWEEN 1 AND 255),
  content_type TEXT NOT NULL,
  size_bytes   INTEGER NOT NULL CHECK (size_bytes >= 0),
  label        TEXT CHECK (char_length(label) <= 120),
  created_at   TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_change_request_files_request ON public.change_request_files(request_id, created_at);

-- ─── RLS ─────────────────────────────────────────────────────────────

ALTER TABLE public.change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_request_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_request_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read change requests"
  ON public.change_requests FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can submit change requests"
  ON public.change_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    AND requester_id = auth.uid()
    AND status = 'submitting'
    AND branch_name IS NULL AND pr_number IS NULL AND pr_url IS NULL
    AND preview_url IS NULL AND verification IS NULL AND claimed_by IS NULL
    AND claimed_at IS NULL AND attempts = 0 AND error IS NULL
  );

CREATE POLICY "Admins can read change request messages"
  ON public.change_request_messages FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can post requester messages"
  ON public.change_request_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    AND author_kind = 'requester'
    AND author_id = auth.uid()
  );

CREATE POLICY "Admins can read change request files"
  ON public.change_request_files FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- No UPDATE/DELETE policies: only the service role (worker) mutates requests,
-- and file rows are written by server code using the service role.

-- ─── Worker claim ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.claim_next_change_request(worker_id TEXT)
RETURNS SETOF public.change_requests
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.change_requests AS cr
  SET status = 'in_progress',
      claimed_by = worker_id,
      claimed_at = now(),
      attempts = cr.attempts + 1,
      error = NULL,
      -- A new attempt invalidates any earlier preview and verdict.
      preview_url = NULL,
      verification = NULL
  WHERE cr.id = (
    SELECT id FROM public.change_requests
    WHERE status = 'queued'
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING cr.*;
$$;

REVOKE ALL ON FUNCTION public.claim_next_change_request(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_change_request(TEXT) TO service_role;

-- ─── Storage ─────────────────────────────────────────────────────────

-- Private bucket; no storage.objects policies, so only the service role can
-- read or write. The admin UI uses server-minted signed URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'change-requests',
  'change-requests',
  false,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;
