-- Migration: Create announcement email webhook trigger
-- Phase: 4c
-- Ticket: 4c-04
--
-- This trigger fires when an announcement is inserted or updated with
-- send_email = true, email_sent_at IS NULL, and published_at IS NOT NULL.
-- It calls the announcement-email Edge Function via pg_net.
--
-- SETUP REQUIRED:
--   1. Deploy the Edge Function: supabase functions deploy announcement-email
--   2. Store secrets in Supabase Vault (Dashboard → Settings → Vault):
--      - edge_function_base_url: e.g. https://<project-ref>.supabase.co/functions/v1
--      - service_role_key: your project's service_role key

-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ─── Trigger Function ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trigger_announcement_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _base_url TEXT;
  _service_key TEXT;
BEGIN
  -- Only fire when conditions are met
  IF NEW.send_email = true
    AND NEW.email_sent_at IS NULL
    AND NEW.published_at IS NOT NULL
  THEN
    -- Read Edge Function URL and service key from Supabase Vault
    SELECT decrypted_secret INTO _base_url
      FROM vault.decrypted_secrets
      WHERE name = 'edge_function_base_url'
      LIMIT 1;

    SELECT decrypted_secret INTO _service_key
      FROM vault.decrypted_secrets
      WHERE name = 'service_role_key'
      LIMIT 1;

    -- Call the Edge Function via pg_net
    IF _base_url IS NOT NULL AND _service_key IS NOT NULL THEN
      PERFORM net.http_post(
        url := _base_url || '/announcement-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || _service_key
        ),
        body := jsonb_build_object(
          'type', TG_OP,
          'table', TG_TABLE_NAME,
          'schema', TG_TABLE_SCHEMA,
          'record', row_to_json(NEW)
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ─── Trigger ────────────────────────────────────────────────────────

CREATE TRIGGER on_announcement_email_broadcast
  AFTER INSERT OR UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_announcement_email();
