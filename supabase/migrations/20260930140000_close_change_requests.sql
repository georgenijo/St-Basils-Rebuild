-- Close (reject) a website change request from the admin console (#361).
--
-- The site flips a request to `closed` (only from queued, ready_for_review or
-- needs_attention) and sets `github_cleanup_pending` when it has (or may
-- have) a pull request or branch. The worker, which holds the GitHub credential, closes
-- the PR and deletes the worker branch in its maintenance sweep, then clears
-- the flag. `closed` is final: a trigger rejects any later status change
-- except to `merged` (a PR merged on GitHub before the close was processed),
-- so a closed request can never be queued or claimed again.

ALTER TABLE public.change_requests
  ADD COLUMN IF NOT EXISTS github_cleanup_pending BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_change_requests_cleanup_pending
  ON public.change_requests (updated_at)
  WHERE github_cleanup_pending;

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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS change_requests_closed_is_final ON public.change_requests;
CREATE TRIGGER change_requests_closed_is_final
  BEFORE UPDATE OF status ON public.change_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.change_requests_closed_is_final();

-- Close a request as the signed-in admin, atomically with the row locked.
-- Returns the outcome ('closed', 'not_closable', 'not_found'), the status
-- before, and whether GitHub cleanup is pending. The reason is stored as the
-- admin's message in the private thread; it is never sent to GitHub.
CREATE OR REPLACE FUNCTION public.close_change_request(p_request_id UUID, p_reason TEXT)
RETURNS TABLE (outcome TEXT, previous_status TEXT, cleanup_pending BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.change_requests%ROWTYPE;
  v_cleanup BOOLEAN;
  v_reason TEXT := btrim(coalesce(p_reason, ''));
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin access required' USING ERRCODE = '42501';
  END IF;
  IF char_length(v_reason) NOT BETWEEN 3 AND 1000 THEN
    RAISE EXCEPTION 'a reason of 3 to 1000 characters is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_request FROM public.change_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::TEXT, NULL::TEXT, false;
    RETURN;
  END IF;
  -- In-flight requests (in_progress / verifying) belong to a running worker.
  IF v_request.status NOT IN ('queued', 'ready_for_review', 'needs_attention') THEN
    RETURN QUERY SELECT 'not_closable'::TEXT, v_request.status, false;
    RETURN;
  END IF;

  -- Any claimed attempt may have pushed a branch or opened a PR, even if it
  -- failed before recording them; the worker resolves the deterministic names.
  v_cleanup := v_request.pr_number IS NOT NULL
    OR v_request.branch_name IS NOT NULL
    OR v_request.attempts > 0;
  UPDATE public.change_requests
  SET status = 'closed',
      claimed_by = NULL,
      claimed_at = NULL,
      error = NULL,
      github_cleanup_pending = v_cleanup
  WHERE id = p_request_id;

  INSERT INTO public.change_request_messages (request_id, author_kind, author_id, body)
  VALUES (p_request_id, 'requester', auth.uid(), 'Closed this request: ' || v_reason);

  RETURN QUERY SELECT 'closed'::TEXT, v_request.status, v_cleanup;
END;
$$;

REVOKE ALL ON FUNCTION public.close_change_request(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_change_request(UUID, TEXT) TO authenticated;
