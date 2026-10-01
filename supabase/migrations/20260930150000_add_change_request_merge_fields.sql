-- Approve & merge from the request page (#359).
--
-- Approval is a reservation first: `begin_change_request_merge` atomically
-- moves a verified `ready_for_review` request to the new `merging` status,
-- bound to the exact verified commit the admin saw, and records who approved
-- it and when. Only then does the site call GitHub. Close, revision and the
-- worker's claim all refuse a `merging` request, so a merge can never publish
-- a change that was closed or superseded meanwhile.
-- `record_change_request_merge` (service role: the site after GitHub merged,
-- or the worker's PR sync) finalises status, merge commit and the thread
-- entry in one transaction and is idempotent. `release_change_request_merge`
-- returns an unmerged reservation to `ready_for_review`.
-- `merged` becomes final like `closed`. Additive otherwise.

ALTER TABLE public.change_requests DROP CONSTRAINT IF EXISTS change_requests_status_check;
ALTER TABLE public.change_requests
  ADD CONSTRAINT change_requests_status_check CHECK (status IN (
    'submitting', 'queued', 'in_progress', 'verifying', 'ready_for_review',
    'needs_attention', 'merging', 'merged', 'closed'
  ));

ALTER TABLE public.change_requests
  ADD COLUMN IF NOT EXISTS approved_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS approved_sha TEXT NULL,
  ADD COLUMN IF NOT EXISTS approval_id UUID NULL,
  ADD COLUMN IF NOT EXISTS merge_commit_sha TEXT NULL,
  ADD COLUMN IF NOT EXISTS merged_at TIMESTAMPTZ NULL;

ALTER TABLE public.change_requests
  DROP CONSTRAINT IF EXISTS change_requests_approved_sha_check,
  DROP CONSTRAINT IF EXISTS change_requests_merge_commit_sha_check;
ALTER TABLE public.change_requests
  ADD CONSTRAINT change_requests_approved_sha_check
    CHECK (approved_sha IS NULL OR approved_sha ~ '^[0-9a-f]{40}$'),
  ADD CONSTRAINT change_requests_merge_commit_sha_check
    CHECK (merge_commit_sha IS NULL OR merge_commit_sha ~ '^[0-9a-f]{40}$');

COMMENT ON COLUMN public.change_requests.approved_by IS
  'Admin who chose Approve & merge on the request page.';
COMMENT ON COLUMN public.change_requests.approved_sha IS
  'Verified commit the admin approved; the merge is pinned to it.';
COMMENT ON COLUMN public.change_requests.merge_commit_sha IS
  'Commit the pull request was merged as on main.';

-- Same rule as the original policy, extended so admins cannot forge the
-- revision, cleanup, approval or merge fields on insert.
DROP POLICY IF EXISTS "Admins can submit change requests" ON public.change_requests;
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
    AND revision_base_sha IS NULL AND github_cleanup_pending = false
    AND approved_by IS NULL AND approved_at IS NULL AND approved_sha IS NULL AND approval_id IS NULL
    AND merge_commit_sha IS NULL AND merged_at IS NULL
  );

-- `closed` and `merged` are final. Only a late merge may follow a close.
CREATE OR REPLACE FUNCTION public.change_requests_closed_is_final()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'closed' AND NEW.status NOT IN ('closed', 'merged') THEN
    RAISE EXCEPTION 'change request % is closed and cannot become %', OLD.id, NEW.status
      USING ERRCODE = '23514';
  END IF;
  IF OLD.status = 'merged' AND NEW.status <> 'merged' THEN
    RAISE EXCEPTION 'change request % is merged and cannot become %', OLD.id, NEW.status
      USING ERRCODE = '23514';
  END IF;
  -- An approved merge in flight can only finish (merged) or be released
  -- (ready_for_review, through release_change_request_merge), so no other
  -- writer (e.g. a worker's failure handler) can reopen it under the merge.
  IF OLD.status = 'merging' AND NEW.status NOT IN ('merging', 'merged', 'ready_for_review') THEN
    RAISE EXCEPTION 'change request % is being merged and cannot become %', OLD.id, NEW.status
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

-- Reserve a verified, ready request for merging as the signed-in admin.
-- Returns outcome 'reserved' with the reservation's approval_id (needed to
-- release it), 'stale' (not ready, not verified, or a different commit than
-- the one the admin approved) or 'not_found'.
CREATE OR REPLACE FUNCTION public.begin_change_request_merge(p_request_id UUID, p_sha TEXT)
RETURNS TABLE (outcome TEXT, approval_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.change_requests%ROWTYPE;
  v_approval_id UUID := gen_random_uuid();
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin access required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_request FROM public.change_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::TEXT, NULL::UUID;
    RETURN;
  END IF;
  IF v_request.status <> 'ready_for_review'
    OR v_request.pr_number IS NULL
    OR p_sha IS NULL
    OR p_sha !~ '^[0-9a-f]{40}$'
    OR v_request.verification ->> 'verdict' IS DISTINCT FROM 'pass'
    OR v_request.verification ->> 'commit_sha' IS DISTINCT FROM p_sha THEN
    RETURN QUERY SELECT 'stale'::TEXT, NULL::UUID;
    RETURN;
  END IF;
  UPDATE public.change_requests
  SET status = 'merging',
      approved_by = auth.uid(),
      approved_at = now(),
      approved_sha = p_sha,
      approval_id = v_approval_id
  WHERE id = p_request_id;
  RETURN QUERY SELECT 'reserved'::TEXT, v_approval_id;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_change_request_merge(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_change_request_merge(UUID, TEXT) TO authenticated;

-- Give an unmerged reservation back (GitHub refused, or it was never
-- confirmed). Only the reservation identified by p_approval_id is released,
-- and with p_older_than only if it is at least that old, so a stale caller
-- can never cancel a newer approval. The reason goes to the private thread.
CREATE OR REPLACE FUNCTION public.release_change_request_merge(
  p_request_id UUID,
  p_approval_id UUID,
  p_reason TEXT,
  p_older_than INTERVAL DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.change_requests
  SET status = 'ready_for_review',
      approved_by = NULL,
      approved_at = NULL,
      approved_sha = NULL,
      approval_id = NULL
  WHERE id = p_request_id
    AND status = 'merging'
    AND approval_id = p_approval_id
    AND (p_older_than IS NULL OR approved_at <= now() - p_older_than);
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  INSERT INTO public.change_request_messages (request_id, author_kind, author_id, body)
  VALUES (p_request_id, 'system', NULL, left(p_reason, 5000));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.release_change_request_merge(UUID, UUID, TEXT, INTERVAL)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_change_request_merge(UUID, UUID, TEXT, INTERVAL)
  TO service_role;

-- Record that the request's PR (head p_head_sha) was merged as p_merge_sha,
-- with its thread entry, in one transaction. The merge is attributed to the
-- website approval only when the merged head is the approved commit.
-- Idempotent: returns false if already recorded.
CREATE OR REPLACE FUNCTION public.record_change_request_merge(
  p_request_id UUID,
  p_merge_sha TEXT,
  p_head_sha TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.change_requests%ROWTYPE;
  v_who TEXT;
  v_body TEXT;
BEGIN
  IF p_merge_sha IS NULL OR p_merge_sha !~ '^[0-9a-f]{40}$' THEN
    RAISE EXCEPTION 'invalid merge commit' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_request FROM public.change_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF v_request.status = 'merged' THEN
    IF v_request.merge_commit_sha IS NULL THEN
      UPDATE public.change_requests SET merge_commit_sha = p_merge_sha WHERE id = p_request_id;
    END IF;
    RETURN false;
  END IF;

  UPDATE public.change_requests
  SET status = 'merged',
      merge_commit_sha = p_merge_sha,
      merged_at = now(),
      error = NULL,
      github_cleanup_pending = false
  WHERE id = p_request_id;

  IF v_request.status = 'merging'
    AND v_request.approved_by IS NOT NULL
    AND v_request.approved_sha = p_head_sha THEN
    SELECT coalesce(nullif(btrim(full_name), ''), email, 'an administrator') INTO v_who
    FROM public.profiles WHERE id = v_request.approved_by;
    v_body := format(
      'Approved and merged by %s: pull request #%s, verified commit %s, merge commit %s. Vercel deploys it to the live site in a few minutes.',
      coalesce(v_who, 'an administrator'),
      v_request.pr_number,
      left(v_request.approved_sha, 7),
      left(p_merge_sha, 7)
    );
  ELSIF v_request.status = 'closed' THEN
    v_body := format(
      'Pull request #%s had already been merged on GitHub (merge commit %s) before the request was closed, so the change was not withdrawn. Vercel deploys merged changes to the live site.',
      v_request.pr_number,
      left(p_merge_sha, 7)
    );
  ELSIF v_request.status = 'merging' THEN
    v_body := format(
      'Pull request #%s was merged on GitHub (merge commit %s), but not as the approved commit %s, so this is not the website approval. Check the pull request.',
      v_request.pr_number,
      left(p_merge_sha, 7),
      left(v_request.approved_sha, 7)
    );
  ELSE
    v_body := format(
      'Pull request #%s was merged on GitHub (merge commit %s). Vercel deploys it to the live site shortly.',
      v_request.pr_number,
      left(p_merge_sha, 7)
    );
  END IF;
  INSERT INTO public.change_request_messages (request_id, author_kind, author_id, body)
  VALUES (p_request_id, 'system', NULL, v_body);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_change_request_merge(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_change_request_merge(UUID, TEXT, TEXT) TO service_role;
