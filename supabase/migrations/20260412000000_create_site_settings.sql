-- Migration: Create site_settings table
-- Issue: #129
--
-- Single-row configuration table for site theme preferences.
-- Stores font choices and homepage section ordering.

-- ─── Table ────────────────────────────────────────────────────────────

CREATE TABLE public.site_settings (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fonts          JSONB NOT NULL DEFAULT '{}',
  section_order  JSONB NOT NULL DEFAULT '[]',
  updated_at     TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_by     UUID REFERENCES auth.users(id)
);

-- Enforce single-row (singleton) constraint
CREATE UNIQUE INDEX idx_site_settings_singleton ON public.site_settings ((true));

-- ─── Auto-update trigger ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_site_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_site_settings_updated_at();

-- ─── Seed default row ────────────────────────────────────────────────

INSERT INTO public.site_settings (fonts, section_order) VALUES (
  '{
    "heading": { "family": "Raleway", "weights": [300, 400, 600, 700] },
    "body":    { "family": "Roboto", "weights": [400, 500, 700] },
    "nav":     { "family": "Libre Baskerville", "weights": [400, 700] }
  }'::jsonb,
  '["hero", "service-times", "announcements", "events", "about", "contact"]'::jsonb
);

-- ─── RLS ──────────────────────────────────────────────────────────────

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- SELECT: anyone can read (public pages need font settings)
CREATE POLICY "Anyone can read site settings"
  ON public.site_settings FOR SELECT
  TO anon, authenticated
  USING (true);

-- UPDATE: admins only
CREATE POLICY "Admins can update site settings"
  ON public.site_settings FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- INSERT: admins only (for re-seeding if row is missing)
CREATE POLICY "Admins can insert site settings"
  ON public.site_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- No DELETE policy — settings row should never be deleted.
