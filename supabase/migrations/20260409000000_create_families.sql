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

-- Unique index on (id, family_id) to support composite FK in family_members
-- that enforces a linked profile belongs to the same family.
CREATE UNIQUE INDEX idx_profiles_id_family_unique ON public.profiles(id, family_id);

-- Composite FK: ensures head_of_household profile belongs to THIS family.
-- Requires idx_profiles_id_family_unique above to exist first.
-- MATCH SIMPLE (default): skipped when head_of_household IS NULL, so families
-- can be created before a head is assigned.
ALTER TABLE public.families
  ADD CONSTRAINT fk_families_head_of_household_family
  FOREIGN KEY (head_of_household, id)
  REFERENCES public.profiles(id, family_id);

-- ─── Protect profiles.family_id from self-assignment ────────────────────
-- Drop and recreate the user self-update policy to also prevent users from
-- reassigning their own family_id, which would bypass family-scoped RLS.

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()) AND is_active = true)
  WITH CHECK (
    id = (SELECT auth.uid())
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = (SELECT auth.uid()))
    AND is_active = (SELECT p.is_active FROM public.profiles p WHERE p.id = (SELECT auth.uid()))
    AND family_id IS NOT DISTINCT FROM (SELECT p.family_id FROM public.profiles p WHERE p.id = (SELECT auth.uid()))
  );

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

-- UPDATE: members can update non-admin fields; admins can update everything.
-- Non-admins are blocked from changing membership_status, membership_type,
-- membership_expires_at, and head_of_household (admin-controlled columns).
CREATE POLICY "Update families"
  ON public.families FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR id = (SELECT family_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  )
  WITH CHECK (
    public.is_admin()
    OR (
      id = (SELECT family_id FROM public.profiles WHERE id = (SELECT auth.uid()))
      -- Prevent non-admins from changing admin-controlled columns.
      -- Use families.id (outer row reference) so the subquery filters to THIS
      -- family, not f.id = f.id (always-true self-match via the inner alias).
      AND membership_status = (SELECT f.membership_status FROM public.families f WHERE f.id = families.id)
      AND membership_type IS NOT DISTINCT FROM (SELECT f.membership_type FROM public.families f WHERE f.id = families.id)
      AND membership_expires_at IS NOT DISTINCT FROM (SELECT f.membership_expires_at FROM public.families f WHERE f.id = families.id)
      AND head_of_household IS NOT DISTINCT FROM (SELECT f.head_of_household FROM public.families f WHERE f.id = families.id)
    )
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
