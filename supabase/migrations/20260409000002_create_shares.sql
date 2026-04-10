-- Migration: Create shares table
-- Issue: #147

CREATE TABLE public.shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  year INT NOT NULL,
  -- amount must be non-negative; paid status is always false on insert (see trigger)
  amount NUMERIC(10,2) NOT NULL DEFAULT 50 CHECK (amount >= 0),
  paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  -- Prevent duplicate remembrance shares for the same person in the same year
  CONSTRAINT uq_shares_family_person_year UNIQUE (family_id, person_name, year)
);

-- Unique key on (id, family_id) to support composite FK from payments,
-- ensuring a payment cannot reference a share owned by a different family.
ALTER TABLE public.shares ADD CONSTRAINT uq_shares_id_family UNIQUE (id, family_id);

-- Indexes
CREATE INDEX idx_shares_family_id ON public.shares(family_id);
CREATE INDEX idx_shares_year ON public.shares(year);
CREATE INDEX idx_shares_year_paid ON public.shares(year, paid);

-- Auto-update updated_at
CREATE TRIGGER set_shares_updated_at
  BEFORE UPDATE ON public.shares
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Trigger: block paid=true on INSERT ──────────────────────────────────
-- Members should not be able to mark a share as paid at insert time.
-- Paid status is admin-only via UPDATE. This trigger enforces it at the DB
-- level regardless of the RLS path used.

CREATE OR REPLACE FUNCTION fn_shares_block_paid_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  NEW.paid := false;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_shares_block_paid_on_insert
  BEFORE INSERT ON public.shares
  FOR EACH ROW EXECUTE FUNCTION fn_shares_block_paid_on_insert();

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

-- INSERT: members buy shares for their own family at the fixed $50 rate.
-- Non-admins are restricted to paid=false and amount=50 at the policy level.
-- The trigger also forces paid=false as a DB-level safety net for all paths.
CREATE POLICY "Insert shares"
  ON public.shares FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      family_id = (SELECT family_id FROM public.profiles WHERE id = (SELECT auth.uid()))
      AND paid = false
      AND amount = 50
    )
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
