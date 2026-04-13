-- Migration: Add directory_visible column to families + directory RLS policies
-- Issue: #185

-- ─── Step 1: Add column ──────────────────────────────────────────────

ALTER TABLE public.families
  ADD COLUMN directory_visible BOOLEAN NOT NULL DEFAULT true;

-- ─── Step 2: RLS policy — members can read directory-visible families ─

CREATE POLICY "Members can read directory families"
  ON public.families FOR SELECT
  TO authenticated
  USING (
    directory_visible = true
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.is_active = true
    )
  );

-- ─── Step 3: RLS policy — members can read family members of visible families ─

CREATE POLICY "Members can read directory family members"
  ON public.family_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.families
      WHERE families.id = family_members.family_id
      AND families.directory_visible = true
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.is_active = true
    )
  );
