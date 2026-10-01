-- Confirm a merged change is live on stbasilsboston.org (#362).
--
-- After a merge the worker waits for the Vercel production deployment of the
-- merge commit (or a later one that contains it), checks the request's page
-- on the live domain, and moves the request to the new final status `live`.
-- A failed or missing deployment keeps it `merged` with `error` set and
-- `live_check_failed_at` stamped, so it is reported once and not retried.

ALTER TABLE public.change_requests DROP CONSTRAINT IF EXISTS change_requests_status_check;
ALTER TABLE public.change_requests
  ADD CONSTRAINT change_requests_status_check CHECK (status IN (
    'submitting', 'queued', 'in_progress', 'verifying', 'ready_for_review',
    'needs_attention', 'merging', 'merged', 'live', 'closed'
  ));

ALTER TABLE public.change_requests
  ADD COLUMN IF NOT EXISTS live_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS live_check_failed_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_change_requests_awaiting_live
  ON public.change_requests (merged_at)
  WHERE status = 'merged' AND live_check_failed_at IS NULL;

-- `closed`, `merged` and `live` are final; `merged` may only become `live`.
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
  IF OLD.status = 'merged' AND NEW.status NOT IN ('merged', 'live') THEN
    RAISE EXCEPTION 'change request % is merged and cannot become %', OLD.id, NEW.status
      USING ERRCODE = '23514';
  END IF;
  IF OLD.status = 'live' AND NEW.status <> 'live' THEN
    RAISE EXCEPTION 'change request % is live and cannot become %', OLD.id, NEW.status
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

-- The insert policy also covers the new columns.
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
    AND live_at IS NULL AND live_check_failed_at IS NULL
  );
