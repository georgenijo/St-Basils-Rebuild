-- Migration: Add directory_visible column to families + directory RLS policies
-- Issue: #185
-- NOTE: Idempotent — safe to re-run if partially applied by a prior collision.

-- ─── Step 1: Add column ──────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'families' AND column_name = 'directory_visible'
  ) THEN
    ALTER TABLE public.families ADD COLUMN directory_visible BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

-- ─── Step 2: RLS policy — members can read directory-visible families ─

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'families' AND policyname = 'Members can read directory families') THEN
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
  END IF;
END $$;

-- ─── Step 3: RLS policy — members can read family members of visible families ─

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'family_members' AND policyname = 'Members can read directory family members') THEN
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
  END IF;
END $$;
