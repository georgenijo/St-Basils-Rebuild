-- Migration: Create families table and link to profiles
-- Issues: #145

-- ─── Families Table ────────────────────────────────────────────────────

CREATE TABLE public.families (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  head_of_household UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  family_name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  membership_status TEXT NOT NULL DEFAULT 'pending' CHECK (membership_status IN ('active', 'expired', 'pending')),
  membership_type TEXT CHECK (membership_type IN ('monthly', 'annual')),
  membership_expires_at DATE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX idx_families_head_of_household ON public.families(head_of_household);
CREATE INDEX idx_families_membership_status ON public.families(membership_status);

-- ─── Link profiles to families ──────────────────────────────────────────
-- Must happen before RLS policies that reference profiles.family_id

ALTER TABLE public.profiles
  ADD COLUMN family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
  ADD COLUMN phone TEXT;

CREATE INDEX idx_profiles_family_id ON public.profiles(family_id);

-- Enable RLS
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies ──────────────────────────────────────────────────────
-- Member + admin merged into single policies per action to avoid multiple
-- permissive policy overhead. auth.uid() wrapped in (select ...) so it
-- evaluates once per query, not per row.

-- SELECT: members see their own family, admins see all
CREATE POLICY "Select families"
  ON public.families FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR id = (SELECT family_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

-- INSERT: admins only
CREATE POLICY "Admins can insert families"
  ON public.families FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- UPDATE: members update their own family, admins update all
CREATE POLICY "Update families"
  ON public.families FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR id = (SELECT family_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  )
  WITH CHECK (
    public.is_admin()
    OR id = (SELECT family_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

-- DELETE: admins only
CREATE POLICY "Admins can delete families"
  ON public.families FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Auto-update updated_at
CREATE TRIGGER set_families_updated_at
  BEFORE UPDATE ON public.families
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
