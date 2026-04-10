-- Migration: Create event_charges table
-- Issue: #149

CREATE TABLE public.event_charges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX idx_event_charges_event_id ON public.event_charges(event_id);
CREATE INDEX idx_event_charges_family_id ON public.event_charges(family_id);
CREATE INDEX idx_event_charges_family_paid ON public.event_charges(family_id, paid);

-- Enable RLS
ALTER TABLE public.event_charges ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies ──────────────────────────────────────────────────────
-- Member + admin merged into single policies per action to avoid multiple
-- permissive policy overhead. auth.uid() wrapped in (select ...) so it
-- evaluates once per query, not per row.

-- SELECT: members see their own family's charges, admins see all
CREATE POLICY "Select event charges"
  ON public.event_charges FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR family_id = (SELECT family_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

-- INSERT: admins only (admin assigns charges to families after events)
CREATE POLICY "Admins can insert event charges"
  ON public.event_charges FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- UPDATE: admins only (mark paid, adjust amount)
CREATE POLICY "Admins can update event charges"
  ON public.event_charges FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- DELETE: admins only
CREATE POLICY "Admins can delete event charges"
  ON public.event_charges FOR DELETE
  TO authenticated
  USING (public.is_admin());
