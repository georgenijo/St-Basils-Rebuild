-- Migration: Create payments table
-- Issue: #148

CREATE TABLE public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('membership', 'share', 'event', 'donation')),
  amount NUMERIC NOT NULL,
  method TEXT CHECK (method IN ('cash', 'check', 'zelle', 'online')),
  note TEXT,
  recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  related_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  related_share_id UUID REFERENCES public.shares(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

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

-- INSERT: members can record donations for their own family; admins record any type
CREATE POLICY "Insert payments"
  ON public.payments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      type = 'donation'
      AND family_id = (SELECT family_id FROM public.profiles WHERE id = (SELECT auth.uid()))
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
