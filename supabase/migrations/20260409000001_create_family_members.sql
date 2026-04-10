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

-- RLS Policies

-- SELECT: members can read their own family's members
CREATE POLICY "Members can read own family members"
  ON public.family_members FOR SELECT
  TO authenticated
  USING (
    family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid())
  );

-- SELECT: admins can read all
CREATE POLICY "Admins can read all family members"
  ON public.family_members FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- INSERT: members can add to their own family
CREATE POLICY "Members can insert own family members"
  ON public.family_members FOR INSERT
  TO authenticated
  WITH CHECK (
    family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid())
  );

-- INSERT: admins can insert any
CREATE POLICY "Admins can insert family members"
  ON public.family_members FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- UPDATE: members can update their own family's members
CREATE POLICY "Members can update own family members"
  ON public.family_members FOR UPDATE
  TO authenticated
  USING (
    family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid())
  );

-- UPDATE: admins can update all
CREATE POLICY "Admins can update all family members"
  ON public.family_members FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- DELETE: members can remove from their own family
CREATE POLICY "Members can delete own family members"
  ON public.family_members FOR DELETE
  TO authenticated
  USING (
    family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid())
  );

-- DELETE: admins can delete all
CREATE POLICY "Admins can delete all family members"
  ON public.family_members FOR DELETE
  TO authenticated
  USING (public.is_admin());
