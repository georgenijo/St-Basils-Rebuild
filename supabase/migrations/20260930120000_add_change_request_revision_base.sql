-- Revision replies on ready-for-review website change requests (#360).
--
-- When an admin chooses "Request changes" on a request that is ready for
-- review, the site records the commit that was verified on the preview here
-- and requeues the request. The worker then builds the revision on top of
-- that commit on the same branch and pull request, instead of rebuilding the
-- change from main. Requester messages also record what the admin meant:
-- `note` (saved only; the agent must not act on it) or `revision` (the
-- requested changes). Additive and nullable: existing rows and older workers
-- are unaffected.

ALTER TABLE public.change_requests
  ADD COLUMN IF NOT EXISTS revision_base_sha TEXT NULL;

ALTER TABLE public.change_requests
  DROP CONSTRAINT IF EXISTS change_requests_revision_base_sha_check;

ALTER TABLE public.change_requests
  ADD CONSTRAINT change_requests_revision_base_sha_check
  CHECK (revision_base_sha IS NULL OR revision_base_sha ~ '^[0-9a-f]{40}$');

COMMENT ON COLUMN public.change_requests.revision_base_sha IS
  'Verified commit a requested revision builds on; set by the site when an admin requests changes.';

ALTER TABLE public.change_request_messages
  ADD COLUMN IF NOT EXISTS intent TEXT NULL;

ALTER TABLE public.change_request_messages
  DROP CONSTRAINT IF EXISTS change_request_messages_intent_check;

ALTER TABLE public.change_request_messages
  ADD CONSTRAINT change_request_messages_intent_check
  CHECK (intent IS NULL OR (author_kind = 'requester' AND intent IN ('note', 'revision')));

COMMENT ON COLUMN public.change_request_messages.intent IS
  'Requester replies on ready requests: note (not an instruction) or revision (requested changes).';

-- One transaction for a requester reply and any requeue it causes, with the
-- request row locked, so concurrent or stale submissions are never
-- misread: `note` / `revision` are only accepted while the request is still
-- ready for review (otherwise nothing is saved and 'stale' is returned), a
-- losing revision is never visible to the worker, and only an explicit
-- `requeue` reply sends a needs_attention request back to the queue.
--
-- p_intent: 'reply' (plain reply), 'requeue' (reply to a needs_attention
-- request), 'note' or 'revision' (ready-for-review choices).
-- Returns the outcome ('posted', 'requeued', 'revision', 'stale',
-- 'not_found'), the status before the reply, and the new message id.
CREATE OR REPLACE FUNCTION public.reply_to_change_request(
  p_request_id UUID,
  p_body TEXT,
  p_intent TEXT
)
RETURNS TABLE (outcome TEXT, previous_status TEXT, message_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.change_requests%ROWTYPE;
  v_intent TEXT;
  v_sha TEXT;
  v_message_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_intent IS NULL OR p_intent NOT IN ('reply', 'requeue', 'note', 'revision') THEN
    RAISE EXCEPTION 'invalid reply intent' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_request FROM public.change_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::TEXT, NULL::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF p_intent IN ('note', 'revision') AND v_request.status <> 'ready_for_review' THEN
    RETURN QUERY SELECT 'stale'::TEXT, v_request.status, NULL::UUID;
    RETURN;
  END IF;

  -- Any reply that lands while the request is ready for review is a note
  -- unless it explicitly requests changes.
  v_intent := CASE
    WHEN p_intent IN ('note', 'revision') THEN p_intent
    WHEN v_request.status = 'ready_for_review' THEN 'note'
    ELSE NULL
  END;

  INSERT INTO public.change_request_messages (request_id, author_kind, author_id, body, intent)
  VALUES (p_request_id, 'requester', auth.uid(), p_body, v_intent)
  RETURNING id INTO v_message_id;

  IF p_intent = 'revision' THEN
    v_sha := v_request.verification ->> 'commit_sha';
    UPDATE public.change_requests
    SET status = 'queued',
        claimed_by = NULL,
        claimed_at = NULL,
        attempts = 0,
        -- Without a verified commit the worker rebuilds from the whole thread.
        revision_base_sha = CASE WHEN v_sha ~ '^[0-9a-f]{40}$' THEN v_sha ELSE NULL END
    WHERE id = p_request_id;
    RETURN QUERY SELECT 'revision'::TEXT, v_request.status, v_message_id;
  ELSIF p_intent = 'requeue' AND v_request.status = 'needs_attention' THEN
    UPDATE public.change_requests
    SET status = 'queued', claimed_by = NULL, claimed_at = NULL
    WHERE id = p_request_id;
    RETURN QUERY SELECT 'requeued'::TEXT, v_request.status, v_message_id;
  ELSE
    RETURN QUERY SELECT 'posted'::TEXT, v_request.status, v_message_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.reply_to_change_request(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reply_to_change_request(UUID, TEXT, TEXT) TO authenticated;
