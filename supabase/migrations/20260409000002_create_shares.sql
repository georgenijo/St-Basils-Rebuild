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

-- RLS Policies

-- SELECT: members can read their own family's shares
CREATE POLICY "Members can read own family shares"
  ON public.shares FOR SELECT
  TO authenticated
  USING (
    family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid())
  );

-- SELECT: admins can read all shares
CREATE POLICY "Admins can read all shares"
  ON public.shares FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- INSERT: members can buy shares for their own family
CREATE POLICY "Members can insert own family shares"
  ON public.shares FOR INSERT
  TO authenticated
  WITH CHECK (
    family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid())
  );

-- INSERT: admins can insert any shares
CREATE POLICY "Admins can insert shares"
  ON public.shares FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

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
