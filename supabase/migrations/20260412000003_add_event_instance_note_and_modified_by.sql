-- Migration: Add note and modified_by columns to event_instances
-- Issue: #181 — Admin edit/cancel individual occurrences of recurring events
-- NOTE: Idempotent — safe to re-run if columns were partially created by a prior collision.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'event_instances' AND column_name = 'note'
  ) THEN
    ALTER TABLE public.event_instances ADD COLUMN note TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'event_instances' AND column_name = 'modified_by'
  ) THEN
    ALTER TABLE public.event_instances
      ADD COLUMN modified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_event_instances_modified_by ON public.event_instances(modified_by);
