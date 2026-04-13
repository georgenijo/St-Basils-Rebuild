-- Migration: Create site_settings table
-- Issue: #129
--
-- Single-row configuration table for site theme preferences.
-- Stores font choices and homepage section ordering.
-- NOTE: Idempotent — safe to re-run if table was partially created by a prior collision.

-- ─── Table ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.site_settings (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fonts          JSONB NOT NULL DEFAULT '{}',
  section_order  JSONB NOT NULL DEFAULT '[]',
  updated_at     TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_by     UUID REFERENCES auth.users(id)
);

-- Enforce single-row (singleton) constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_site_settings_singleton ON public.site_settings ((true));

-- ─── Auto-update trigger ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_site_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger (no IF NOT EXISTS for triggers)
DROP TRIGGER IF EXISTS trg_site_settings_updated_at ON public.site_settings;
CREATE TRIGGER trg_site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_site_settings_updated_at();

-- ─── Seed default row ────────────────────────────────────────────────

INSERT INTO public.site_settings (fonts, section_order)
SELECT
  '{
    "heading": { "family": "Raleway", "weights": [300, 400, 600, 700] },
    "body":    { "family": "Roboto", "weights": [400, 500, 700] },
    "nav":     { "family": "Libre Baskerville", "weights": [400, 700] }
  }'::jsonb,
  '["hero", "service-times", "announcements", "events", "about", "contact"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.site_settings);

-- ─── RLS ──────────────────────────────────────────────────────────────

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- SELECT: anyone can read (public pages need font settings)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'site_settings' AND policyname = 'Anyone can read site settings') THEN
    CREATE POLICY "Anyone can read site settings"
      ON public.site_settings FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

-- UPDATE: admins only
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'site_settings' AND policyname = 'Admins can update site settings') THEN
    CREATE POLICY "Admins can update site settings"
      ON public.site_settings FOR UPDATE
      TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;

-- INSERT: admins only (for re-seeding if row is missing)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'site_settings' AND policyname = 'Admins can insert site settings') THEN
    CREATE POLICY "Admins can insert site settings"
      ON public.site_settings FOR INSERT
      TO authenticated
      WITH CHECK (public.is_admin());
  END IF;
END $$;

-- No DELETE policy — settings row should never be deleted.
