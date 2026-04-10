-- Migration: Create shares table
-- Issue: #147

CREATE TABLE public.shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  year INT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 50,
  paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX idx_shares_family_id ON public.shares(family_id);
CREATE INDEX idx_shares_year ON public.shares(year);
CREATE INDEX idx_shares_year_paid ON public.shares(year, paid);

-- Enable RLS
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies ──────────────────────────────────────────────────────
-- Member + admin merged into single policies per action to avoid multiple
-- permissive policy overhead. auth.uid() wrapped in (select ...) so it
-- evaluates once per query, not per row.

-- SELECT: members see their own family's shares, admins see all
CREATE POLICY "Select shares"
  ON public.shares FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR family_id = (SELECT family_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

-- INSERT: members buy shares for their own family, admins insert any
CREATE POLICY "Insert shares"
  ON public.shares FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR family_id = (SELECT family_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

-- UPDATE: admins only (paid status, corrections)
CREATE POLICY "Admins can update shares"
  ON public.shares FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- DELETE: admins only
CREATE POLICY "Admins can delete shares"
  ON public.shares FOR DELETE
  TO authenticated
  USING (public.is_admin());
