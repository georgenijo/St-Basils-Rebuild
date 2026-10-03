-- Additive delivery ledger; no subscriber payloads, credentials or tenant
-- data rewrites. Only the service role can access the ledger/RPCs.
CREATE TABLE public.announcement_email_broadcasts (
  announcement_id UUID PRIMARY KEY REFERENCES public.announcements(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL,
  state TEXT NOT NULL DEFAULT 'sending' CHECK (state IN ('sending', 'needs_reconciliation', 'completed')),
  recipient_count INTEGER NOT NULL CHECK (recipient_count >= 0),
  accepted_count INTEGER NOT NULL DEFAULT 0 CHECK (accepted_count >= 0 AND accepted_count <= recipient_count),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE public.announcement_email_broadcasts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.announcement_email_broadcasts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.announcement_email_broadcasts TO service_role;

-- Lock the announcement to serialize claim creation and check CURRENT
-- eligibility/content. The unique ledger row is the durable race guard.
CREATE FUNCTION public.claim_announcement_email(p_id UUID, p_attempt UUID, p_total INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  a public.announcements%ROWTYPE;
BEGIN
  SELECT * INTO STRICT a FROM public.announcements WHERE id = p_id FOR UPDATE;
  IF a.email_sent_at IS NOT NULL THEN
    RETURN jsonb_build_object('outcome', 'already_sent');
  END IF;
  IF NOT a.send_email OR a.published_at IS NULL THEN
    RETURN jsonb_build_object('outcome', 'ineligible');
  END IF;
  INSERT INTO public.announcement_email_broadcasts (announcement_id, attempt_id, recipient_count)
    VALUES (p_id, p_attempt, p_total) ON CONFLICT (announcement_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'blocked');
  END IF;
  RETURN jsonb_build_object('outcome', 'claimed', 'record', to_jsonb(a));
END;
$$;

-- One transaction completes the ledger and announcement. A missing/mismatched
-- claim or incomplete progress is an error, never a successful no-op.
CREATE FUNCTION public.complete_announcement_email(p_id UUID, p_attempt UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Same lock order as claim (announcement, then ledger).
  PERFORM 1 FROM public.announcements WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Announcement not found'; END IF;
  UPDATE public.announcement_email_broadcasts
    SET state = 'completed', completed_at = now()
    WHERE announcement_id = p_id AND attempt_id = p_attempt
      AND state = 'sending' AND accepted_count = recipient_count;
  IF NOT FOUND THEN RAISE EXCEPTION 'Incomplete or mismatched broadcast claim'; END IF;
  UPDATE public.announcements SET email_sent_at = now() WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_announcement_email(UUID, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_announcement_email(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_announcement_email(UUID, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_announcement_email(UUID, UUID) TO service_role;
