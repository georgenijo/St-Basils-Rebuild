-- Migration: Add payment status, reference memo, and expand payment methods
-- Issue: #180
--
-- Adds columns for the zero-fee payment flow: members submit pending payments
-- via Zelle/Venmo/Cash App, treasurer confirms or rejects.

-- ─── New columns ──────────────────────────────────────────────────────

ALTER TABLE public.payments
  ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('pending', 'confirmed', 'rejected')),
  ADD COLUMN reference_memo TEXT,
  ADD COLUMN confirmed_by UUID REFERENCES public.profiles(id),
  ADD COLUMN confirmed_at TIMESTAMPTZ,
  ADD COLUMN rejected_reason TEXT;

-- ─── Expand method CHECK constraint ──────────────────────────────────
-- Add 'venmo' and 'cashapp' as valid payment methods.

ALTER TABLE public.payments DROP CONSTRAINT payments_method_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_method_check
    CHECK (method IN ('cash', 'check', 'zelle', 'venmo', 'cashapp', 'online'));

-- ─── Index for pending queue ─────────────────────────────────────────

CREATE INDEX idx_payments_status ON public.payments(status);

-- ─── Update INSERT RLS policy ────────────────────────────────────────
-- Members can now submit any payment type with status = 'pending'.
-- Admin INSERT is unchanged (can insert any status).

DROP POLICY "Insert payments" ON public.payments;

CREATE POLICY "Insert payments"
  ON public.payments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      family_id = (SELECT family_id FROM public.profiles WHERE id = (SELECT auth.uid()))
      AND recorded_by = (SELECT auth.uid())
      AND status = 'pending'
      AND confirmed_by IS NULL
      AND confirmed_at IS NULL
    )
  );
