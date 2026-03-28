-- Migration: Add is_active column to profiles, update is_admin() and all RLS policies
-- Issue: #133
--
-- Adds soft-deactivation support. A deactivated user is fully locked out:
-- no profile reads, no profile updates, no admin operations on any table.

-- ─── Step 1: Add column ────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

-- ─── Step 2: Update is_admin() function ────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  )
$$;

-- ─── Step 3: Update self-access policies on profiles ───────────────────

-- 3a. "Users can read own profile" — add is_active guard
DROP POLICY "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() AND is_active = true);

-- 3b. "Users can update own profile" — add is_active guard + freeze is_active
DROP POLICY "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() AND is_active = true)
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM public.profiles p WHERE p.id = auth.uid())
    AND is_active = (SELECT is_active FROM public.profiles p WHERE p.id = auth.uid())
  );

-- ─── Step 4: Update inline EXISTS admin policies on other tables ───────
-- All change: AND role = 'admin'  →  AND role = 'admin' AND is_active = true

-- ── contact_submissions (2 policies) ──

DROP POLICY "Admins can read contact submissions" ON public.contact_submissions;
CREATE POLICY "Admins can read contact submissions"
  ON public.contact_submissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  );

DROP POLICY "Admins can delete contact submissions" ON public.contact_submissions;
CREATE POLICY "Admins can delete contact submissions"
  ON public.contact_submissions FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  );

-- ── events (3 policies) ──

DROP POLICY "Admins can insert events" ON public.events;
CREATE POLICY "Admins can insert events"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  );

DROP POLICY "Admins can update events" ON public.events;
CREATE POLICY "Admins can update events"
  ON public.events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  );

DROP POLICY "Admins can delete events" ON public.events;
CREATE POLICY "Admins can delete events"
  ON public.events FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  );

-- ── recurrence_rules (3 policies) ──

DROP POLICY "Admins can insert recurrence rules" ON public.recurrence_rules;
CREATE POLICY "Admins can insert recurrence rules"
  ON public.recurrence_rules FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  );

DROP POLICY "Admins can update recurrence rules" ON public.recurrence_rules;
CREATE POLICY "Admins can update recurrence rules"
  ON public.recurrence_rules FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  );

DROP POLICY "Admins can delete recurrence rules" ON public.recurrence_rules;
CREATE POLICY "Admins can delete recurrence rules"
  ON public.recurrence_rules FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  );

-- ── event_instances (3 policies) ──

DROP POLICY "Admins can insert event instances" ON public.event_instances;
CREATE POLICY "Admins can insert event instances"
  ON public.event_instances FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  );

DROP POLICY "Admins can update event instances" ON public.event_instances;
CREATE POLICY "Admins can update event instances"
  ON public.event_instances FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  );

DROP POLICY "Admins can delete event instances" ON public.event_instances;
CREATE POLICY "Admins can delete event instances"
  ON public.event_instances FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  );

-- ── announcements (4 policies) ──

DROP POLICY "Admins can read all announcements" ON public.announcements;
CREATE POLICY "Admins can read all announcements"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  );

DROP POLICY "Admins can insert announcements" ON public.announcements;
CREATE POLICY "Admins can insert announcements"
  ON public.announcements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  );

DROP POLICY "Admins can update announcements" ON public.announcements;
CREATE POLICY "Admins can update announcements"
  ON public.announcements FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  );

DROP POLICY "Admins can delete announcements" ON public.announcements;
CREATE POLICY "Admins can delete announcements"
  ON public.announcements FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  );

-- ── email_subscribers (3 policies) ──

DROP POLICY "Admins can read subscribers" ON public.email_subscribers;
CREATE POLICY "Admins can read subscribers"
  ON public.email_subscribers FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  );

DROP POLICY "Admins can update subscribers" ON public.email_subscribers;
CREATE POLICY "Admins can update subscribers"
  ON public.email_subscribers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  );

DROP POLICY "Admins can delete subscribers" ON public.email_subscribers;
CREATE POLICY "Admins can delete subscribers"
  ON public.email_subscribers FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true)
  );
