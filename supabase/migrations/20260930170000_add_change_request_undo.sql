-- Undo a live change with a revert PR (#363).
--
-- "Undo" on a live (or merged) request creates a linked undo request:
-- `revert_of` points at the original and `revert_commit_sha` is its merge
-- commit. The worker reverts that commit instead of running the agent, then
-- the undo goes through the normal review path (CI, preview verification,
-- Approve & merge, live check). Both threads link to each other.

ALTER TABLE public.change_requests
  ADD COLUMN IF NOT EXISTS revert_of UUID NULL
    REFERENCES public.change_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revert_commit_sha TEXT NULL;

ALTER TABLE public.change_requests DROP CONSTRAINT IF EXISTS change_requests_revert_commit_sha_check;
ALTER TABLE public.change_requests
  ADD CONSTRAINT change_requests_revert_commit_sha_check
  CHECK (revert_commit_sha IS NULL OR revert_commit_sha ~ '^[0-9a-f]{40}$');

CREATE INDEX IF NOT EXISTS idx_change_requests_revert_of
  ON public.change_requests (revert_of) WHERE revert_of IS NOT NULL;

-- Undo requests are only created through request_change_request_undo.
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
    AND revert_of IS NULL AND revert_commit_sha IS NULL
  );

-- Create the undo request for a live or merged request, as the signed-in
-- admin. Returns ('created', new id), ('exists', id of the undo already in
-- progress or done), ('not_undoable', NULL) or ('not_found', NULL).
CREATE OR REPLACE FUNCTION public.request_change_request_undo(p_request_id UUID)
RETURNS TABLE (outcome TEXT, undo_request_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.change_requests%ROWTYPE;
  v_existing UUID;
  v_undo_id UUID := gen_random_uuid();
  v_who TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin access required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_request FROM public.change_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::TEXT, NULL::UUID;
    RETURN;
  END IF;
  IF v_request.status NOT IN ('live', 'merged') OR v_request.merge_commit_sha IS NULL THEN
    RETURN QUERY SELECT 'not_undoable'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- One undo at a time: reuse an undo that is in progress or already done.
  SELECT id INTO v_existing FROM public.change_requests
  WHERE revert_of = p_request_id AND status <> 'closed'
  ORDER BY created_at DESC
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN QUERY SELECT 'exists'::TEXT, v_existing;
    RETURN;
  END IF;

  INSERT INTO public.change_requests (
    id, requester_id, title, description, page_path, target_selector, target_text,
    status, revert_of, revert_commit_sha
  )
  VALUES (
    v_undo_id,
    auth.uid(),
    left('Undo: ' || v_request.title, 120),
    format(
      'Undo the website change from the request "%s" by reverting it (merge commit %s), so the page looks as it did before that change.',
      left(v_request.title, 200),
      left(v_request.merge_commit_sha, 7)
    ),
    v_request.page_path,
    v_request.target_selector,
    v_request.target_text,
    'queued',
    p_request_id,
    v_request.merge_commit_sha
  );

  SELECT coalesce(nullif(btrim(full_name), ''), email, 'an administrator') INTO v_who
  FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.change_request_messages (request_id, author_kind, author_id, body)
  VALUES
    (
      p_request_id,
      'system',
      NULL,
      format(
        'Undo requested by %s. A new request reverts this change through the normal review path (checks, preview verification, Approve & merge): /admin/requests/%s',
        coalesce(v_who, 'an administrator'),
        v_undo_id
      )
    ),
    (
      v_undo_id,
      'system',
      NULL,
      format(
        'This request undoes /admin/requests/%s. The agent reverts merge commit %s, opens a pull request and verifies the preview as usual.',
        p_request_id,
        left(v_request.merge_commit_sha, 7)
      )
    );

  RETURN QUERY SELECT 'created'::TEXT, v_undo_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_change_request_undo(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_change_request_undo(UUID) TO authenticated;
