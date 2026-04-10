-- Migration: Create family_members table
-- Issue: #146

CREATE TABLE public.family_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  relationship TEXT NOT NULL CHECK (relationship IN ('self', 'spouse', 'child', 'parent', 'sibling', 'other')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX idx_family_members_family_id ON public.family_members(family_id);
CREATE INDEX idx_family_members_profile_id ON public.family_members(profile_id);

-- Enable RLS
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies ──────────────────────────────────────────────────────
-- Member + admin merged into single policies per action to avoid multiple
-- permissive policy overhead. auth.uid() wrapped in (select ...) so it
-- evaluates once per query, not per row.

-- SELECT: members see their own family's members, admins see all
CREATE POLICY "Select family members"
  ON public.family_members FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR family_id = (SELECT family_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

-- INSERT: members add to their own family, admins add to any
CREATE POLICY "Insert family members"
  ON public.family_members FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR family_id = (SELECT family_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

-- UPDATE: members update their own family's members, admins update all
CREATE POLICY "Update family members"
  ON public.family_members FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR family_id = (SELECT family_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  )
  WITH CHECK (
    public.is_admin()
    OR family_id = (SELECT family_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

-- DELETE: members remove from their own family, admins remove any
CREATE POLICY "Delete family members"
  ON public.family_members FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR family_id = (SELECT family_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );
