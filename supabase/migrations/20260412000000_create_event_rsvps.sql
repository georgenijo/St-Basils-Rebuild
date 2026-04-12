-- Migration: Create event_rsvps table and add rsvp_settings to events
-- Issue: #183

-- ─── Add RSVP settings to events ──────────────────────────────────────

ALTER TABLE public.events
  ADD COLUMN rsvp_settings JSONB DEFAULT '{"enabled": false}'::jsonb;

-- ─── Event RSVPs Table ────────────────────────────────────────────────

CREATE TABLE public.event_rsvps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  headcount INT NOT NULL DEFAULT 1,
  children_count INT,
  dietary TEXT,
  bringing TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, name)
);

-- Indexes
CREATE INDEX idx_event_rsvps_event_id ON public.event_rsvps(event_id);
CREATE INDEX idx_event_rsvps_family_id ON public.event_rsvps(family_id);

-- Enable RLS
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies ──────────────────────────────────────────────────────

-- INSERT: anyone can insert an RSVP, but only for events with RSVP enabled.
-- The subquery checks the parent event's rsvp_settings at the DB level,
-- preventing inserts even if the application layer is bypassed.
CREATE POLICY "Public can insert RSVPs"
  ON public.event_rsvps FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_rsvps.event_id
        AND (events.rsvp_settings->>'enabled')::boolean = true
    )
  );

-- SELECT: admins can read all RSVPs
CREATE POLICY "Admins can read all RSVPs"
  ON public.event_rsvps FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- SELECT: members can read their own family's RSVPs
CREATE POLICY "Members can read own family RSVPs"
  ON public.event_rsvps FOR SELECT
  TO authenticated
  USING (
    family_id IS NOT NULL
    AND family_id = (SELECT family_id FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

-- UPDATE: admins only
CREATE POLICY "Admins can update RSVPs"
  ON public.event_rsvps FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- DELETE: admins only
CREATE POLICY "Admins can delete RSVPs"
  ON public.event_rsvps FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Auto-update updated_at
CREATE TRIGGER set_event_rsvps_updated_at
  BEFORE UPDATE ON public.event_rsvps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
