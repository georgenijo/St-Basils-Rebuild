\set ON_ERROR_STOP on
\echo 'announcement email claim integration checks'

-- Assert the migration exposes only the service-role surface and stores no
-- subscriber identity or credential fields.
DO $$
DECLARE
  v_has_pii boolean;
  v_unexpected_columns boolean;
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.announcement_email_broadcasts'::regclass) THEN
    RAISE EXCEPTION 'ledger row-level security is disabled';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'announcement_email_broadcasts') THEN
    RAISE EXCEPTION 'unexpected ledger RLS policy';
  END IF;
  IF has_table_privilege('anon', 'public.announcement_email_broadcasts', 'SELECT,INSERT,UPDATE,DELETE')
    OR has_table_privilege('authenticated', 'public.announcement_email_broadcasts', 'SELECT,INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'untrusted role has ledger privileges';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.announcement_email_broadcasts', 'SELECT')
    OR NOT has_table_privilege('service_role', 'public.announcement_email_broadcasts', 'INSERT')
    OR NOT has_table_privilege('service_role', 'public.announcement_email_broadcasts', 'UPDATE') THEN
    RAISE EXCEPTION 'service_role lacks ledger privileges';
  END IF;
  IF has_function_privilege('anon', 'public.claim_announcement_email(uuid,uuid,integer)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.claim_announcement_email(uuid,uuid,integer)', 'EXECUTE')
    OR has_function_privilege('anon', 'public.complete_announcement_email(uuid,uuid)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.complete_announcement_email(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'untrusted role can execute broadcast RPCs';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.claim_announcement_email(uuid,uuid,integer)', 'EXECUTE')
    OR NOT has_function_privilege('service_role', 'public.complete_announcement_email(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role cannot execute broadcast RPCs';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'announcement_email_broadcasts'
      AND column_name NOT IN ('announcement_id', 'attempt_id', 'state', 'recipient_count', 'accepted_count', 'claimed_at', 'completed_at')
  ) INTO v_unexpected_columns;
  IF v_unexpected_columns THEN RAISE EXCEPTION 'ledger contains columns outside its synthetic-safe schema'; END IF;
  v_has_pii := EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'announcement_email_broadcasts'
      AND column_name IN ('email', 'name', 'unsubscribe_token', 'subscriber_id', 'recipient_email')
  );
  IF v_has_pii THEN RAISE EXCEPTION 'ledger contains subscriber PII columns'; END IF;
  RAISE NOTICE 'PASS security: RLS enabled, no policies, grants restricted to service_role';
  RAISE NOTICE 'PASS privacy: ledger schema contains no subscriber PII columns';
END;
$$;

-- Direct checks as each untrusted role prove ACL enforcement (the privilege
-- assertions above also check the complete grant surface).
SET ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM 1 FROM public.announcement_email_broadcasts;
    RAISE EXCEPTION 'anon unexpectedly read the ledger';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
RESET ROLE;
SET ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM 1 FROM public.announcement_email_broadcasts;
    RAISE EXCEPTION 'authenticated unexpectedly read the ledger';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
RESET ROLE;
\echo 'PASS security: anon and authenticated direct ledger reads are denied'

INSERT INTO public.announcements (id, title, slug, body, send_email, published_at)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'Synthetic eligible', 'synthetic-eligible', '{"type":"doc"}', TRUE, now()),
  ('10000000-0000-0000-0000-000000000002', 'Synthetic unpublished', 'synthetic-unpublished', '{"type":"doc"}', TRUE, NULL),
  ('10000000-0000-0000-0000-000000000003', 'Synthetic disabled', 'synthetic-disabled', '{"type":"doc"}', FALSE, now()),
  ('10000000-0000-0000-0000-000000000004', 'Synthetic sent', 'synthetic-sent', '{"type":"doc"}', TRUE, now());
UPDATE public.announcements SET email_sent_at = now()
WHERE id = '10000000-0000-0000-0000-000000000004';

SET ROLE service_role;
DO $$
DECLARE v_claim jsonb;
BEGIN
  v_claim := public.claim_announcement_email(
    '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 2);
  IF v_claim ->> 'outcome' <> 'claimed' THEN RAISE EXCEPTION 'eligible row was not claimed'; END IF;
  v_claim := public.claim_announcement_email(
    '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 1);
  IF v_claim ->> 'outcome' <> 'ineligible' THEN RAISE EXCEPTION 'unpublished row was not ineligible'; END IF;
  v_claim := public.claim_announcement_email(
    '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 1);
  IF v_claim ->> 'outcome' <> 'ineligible' THEN RAISE EXCEPTION 'disabled row was not ineligible'; END IF;
  v_claim := public.claim_announcement_email(
    '10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 1);
  IF v_claim ->> 'outcome' <> 'already_sent' THEN RAISE EXCEPTION 'sent row was not already_sent'; END IF;
  v_claim := public.claim_announcement_email(
    '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000005', 5);
  IF v_claim ->> 'outcome' <> 'blocked' THEN RAISE EXCEPTION 'duplicate claim was not blocked'; END IF;
  RAISE NOTICE 'PASS outcomes: claimed, ineligible, already_sent, and duplicate blocked';
END;
$$;

-- A completion error is caught only by this harness. Its subtransaction must
-- roll back both the ledger transition and announcement timestamp.
RESET ROLE;
CREATE FUNCTION public.synthetic_fail_email_sent_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.email_sent_at IS DISTINCT FROM OLD.email_sent_at THEN
    RAISE EXCEPTION 'synthetic completion trigger fault';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER synthetic_fail_email_sent_update
BEFORE UPDATE OF email_sent_at ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.synthetic_fail_email_sent_update();
SET ROLE service_role;
UPDATE public.announcement_email_broadcasts SET accepted_count = recipient_count
WHERE announcement_id = '10000000-0000-0000-0000-000000000001'
  AND attempt_id = '20000000-0000-0000-0000-000000000001';
DO $$
BEGIN
  BEGIN
    PERFORM public.complete_announcement_email(
      '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'synthetic trigger fault did not fire';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'synthetic trigger fault did not fire' THEN RAISE; END IF;
    IF SQLERRM <> 'synthetic completion trigger fault' THEN RAISE; END IF;
  END;
  IF (SELECT state FROM public.announcement_email_broadcasts
      WHERE announcement_id = '10000000-0000-0000-0000-000000000001') <> 'sending' THEN
    RAISE EXCEPTION 'failed completion did not roll back ledger state';
  END IF;
  IF (SELECT email_sent_at FROM public.announcements
      WHERE id = '10000000-0000-0000-0000-000000000001') IS NOT NULL THEN
    RAISE EXCEPTION 'failed completion changed announcement timestamp';
  END IF;
  RAISE NOTICE 'PASS atomicity: synthetic completion fault rolls back ledger and announcement';
END;
$$;
UPDATE public.announcement_email_broadcasts SET accepted_count = 0
WHERE announcement_id = '10000000-0000-0000-0000-000000000001'
  AND attempt_id = '20000000-0000-0000-0000-000000000001';
RESET ROLE;
DROP TRIGGER synthetic_fail_email_sent_update ON public.announcements;
DROP FUNCTION public.synthetic_fail_email_sent_update();
SET ROLE service_role;

DO $$
BEGIN
  BEGIN
    PERFORM public.complete_announcement_email(
      '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000099');
    RAISE EXCEPTION 'wrong attempt token unexpectedly completed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'wrong attempt token unexpectedly completed' THEN RAISE; END IF;
    IF SQLERRM <> 'Incomplete or mismatched broadcast claim' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.complete_announcement_email(
      '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'incomplete recipient count unexpectedly completed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'incomplete recipient count unexpectedly completed' THEN RAISE; END IF;
    IF SQLERRM <> 'Incomplete or mismatched broadcast claim' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS completion guards: wrong attempt token and incomplete recipient count rejected';
END;
$$;

-- Complete an eligible claim only after exact recipient progress is recorded.
UPDATE public.announcement_email_broadcasts SET accepted_count = 2
WHERE announcement_id = '10000000-0000-0000-0000-000000000001'
  AND attempt_id = '20000000-0000-0000-0000-000000000001';
SELECT public.complete_announcement_email(
  '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001');
DO $$
BEGIN
  IF (SELECT state FROM public.announcement_email_broadcasts
      WHERE announcement_id = '10000000-0000-0000-0000-000000000001') <> 'completed' THEN
    RAISE EXCEPTION 'successful completion did not complete ledger';
  END IF;
  IF (SELECT email_sent_at FROM public.announcements
      WHERE id = '10000000-0000-0000-0000-000000000001') IS NULL THEN
    RAISE EXCEPTION 'successful completion did not mark announcement sent';
  END IF;
  RAISE NOTICE 'PASS completion: fully accepted broadcast completes both records';
END;
$$;

-- Zero recipients is a valid complete count and must complete without a send.
RESET ROLE;
INSERT INTO public.announcements (id, title, slug, body, send_email, published_at)
VALUES ('10000000-0000-0000-0000-000000000005', 'Synthetic empty audience', 'synthetic-empty', '{"type":"doc"}', TRUE, now());
SET ROLE service_role;
DO $$
DECLARE v_claim jsonb;
BEGIN
  v_claim := public.claim_announcement_email(
    '10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000006', 0);
  IF v_claim ->> 'outcome' <> 'claimed' THEN RAISE EXCEPTION 'zero-recipient claim failed'; END IF;
  PERFORM public.complete_announcement_email(
    '10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000006');
  IF (SELECT state FROM public.announcement_email_broadcasts
      WHERE announcement_id = '10000000-0000-0000-0000-000000000005') <> 'completed' THEN
    RAISE EXCEPTION 'zero-recipient ledger did not complete';
  END IF;
  IF (SELECT email_sent_at FROM public.announcements
      WHERE id = '10000000-0000-0000-0000-000000000005') IS NULL THEN
    RAISE EXCEPTION 'zero-recipient announcement was not marked sent';
  END IF;
  RAISE NOTICE 'PASS zero recipients: claim completes at accepted_count = recipient_count = 0';
END;
$$;
RESET ROLE;

\echo 'announcement email claim SQL checks passed'
