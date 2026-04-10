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

-- RLS Policies

-- SELECT: members can read their own family's payments
CREATE POLICY "Members can read own family payments"
  ON public.payments FOR SELECT
  TO authenticated
  USING (
    family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid())
  );

-- SELECT: admins can read all payments
CREATE POLICY "Admins can read all payments"
  ON public.payments FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- INSERT: members can record donations for their own family
CREATE POLICY "Members can insert own family donations"
  ON public.payments FOR INSERT
  TO authenticated
  WITH CHECK (
    family_id = (SELECT family_id FROM public.profiles WHERE id = auth.uid())
    AND type = 'donation'
  );

-- INSERT: admins can record any payment type
CREATE POLICY "Admins can insert payments"
  ON public.payments FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

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
