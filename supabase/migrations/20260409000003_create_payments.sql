-- Migration: Create payments table
-- Issue: #148

CREATE TABLE public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('membership', 'share', 'event', 'donation')),
  amount NUMERIC(10,2) NOT NULL,
  method TEXT CHECK (method IN ('cash', 'check', 'zelle', 'online')),
  note TEXT,
  recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  related_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  -- Composite FK: ensures the referenced share belongs to the same family as
  -- this payment. Requires uq_shares_id_family on shares(id, family_id).
  -- MATCH SIMPLE (default): skipped when related_share_id IS NULL.
  related_share_id UUID,
  FOREIGN KEY (related_share_id, family_id) REFERENCES public.shares(id, family_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- Enforce consistency between type and relation columns to prevent impossible combos
  CONSTRAINT chk_payments_share_relation
    CHECK (type != 'share' OR (related_share_id IS NOT NULL AND related_event_id IS NULL)),
  CONSTRAINT chk_payments_event_relation
    CHECK (type != 'event' OR (related_event_id IS NOT NULL AND related_share_id IS NULL)),
  CONSTRAINT chk_payments_no_relation
    CHECK (type NOT IN ('membership', 'donation') OR (related_share_id IS NULL AND related_event_id IS NULL))
);

-- Auto-update updated_at
CREATE TRIGGER set_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_payments_family_id ON public.payments(family_id);
CREATE INDEX idx_payments_type ON public.payments(type);
CREATE INDEX idx_payments_created_at ON public.payments(created_at DESC);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies ──────────────────────────────────────────────────────
-- Member + admin merged into single policies per action to avoid multiple
-- permissive policy overhead. auth.uid() wrapped in (select ...) so it
-- evaluates once per query, not per row.

-- SELECT: members see their own family's payments, admins see all
CREATE POLICY "Select payments"
  ON public.payments FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR family_id = (SELECT family_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

-- INSERT: members can record donations for their own family only.
-- Requires recorded_by = their own auth.uid() to prevent impersonation.
-- Admins can record any payment type.
CREATE POLICY "Insert payments"
  ON public.payments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      type = 'donation'
      AND family_id = (SELECT family_id FROM public.profiles WHERE id = (SELECT auth.uid()))
      AND recorded_by = (SELECT auth.uid())
    )
  );

-- UPDATE: admins only
CREATE POLICY "Admins can update payments"
  ON public.payments FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- DELETE: admins only
CREATE POLICY "Admins can delete payments"
  ON public.payments FOR DELETE
  TO authenticated
  USING (public.is_admin());
