-- Migration: Add payment status, reference memo, and expand payment methods
-- Issue: #180
--
-- Adds columns for the zero-fee payment flow: members submit pending payments
-- via Zelle/Venmo/Cash App, treasurer confirms or rejects.
-- NOTE: Idempotent — safe to re-run if partially applied by a prior collision.

-- ─── New columns ──────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.payments
      ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmed'
        CHECK (status IN ('pending', 'confirmed', 'rejected'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'reference_memo'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN reference_memo TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'confirmed_by'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN confirmed_by UUID REFERENCES public.profiles(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'confirmed_at'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN confirmed_at TIMESTAMPTZ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'rejected_reason'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN rejected_reason TEXT;
  END IF;
END $$;

-- ─── Expand method CHECK constraint ──────────────────────────────────
-- Add 'venmo' and 'cashapp' as valid payment methods.

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_method_check;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_method_check'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_method_check
        CHECK (method IN ('cash', 'check', 'zelle', 'venmo', 'cashapp', 'online'));
  END IF;
END $$;

-- ─── Index for pending queue ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- ─── Update INSERT RLS policy ────────────────────────────────────────
-- Members can now submit any payment type with status = 'pending'.
-- Admin INSERT is unchanged (can insert any status).

DROP POLICY IF EXISTS "Insert payments" ON public.payments;

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
