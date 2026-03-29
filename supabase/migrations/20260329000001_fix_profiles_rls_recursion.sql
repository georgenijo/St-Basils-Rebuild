-- Migration: Fix infinite recursion in "Users can update own profile" RLS policy
-- Issue: #140
--
-- The WITH CHECK clause previously sub-queried profiles to freeze role and
-- is_active, which triggered RLS evaluation on the same table → infinite
-- recursion (Postgres error 42P17).
--
-- Fix: use SECURITY DEFINER helper functions that read the row directly,
-- bypassing RLS.

-- ─── Helper functions ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.own_role()
RETURNS text
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.own_is_active()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT is_active FROM public.profiles WHERE id = (SELECT auth.uid())
$$;

-- ─── Replace the broken policy ────────────────────────────────────────

DROP POLICY "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()) AND is_active = true)
  WITH CHECK (
    id = (SELECT auth.uid())
    AND role = public.own_role()
    AND is_active = public.own_is_active()
  );
