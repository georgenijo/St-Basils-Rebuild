-- Migration: Add note and modified_by columns to event_instances
-- Issue: #181 — Admin edit/cancel individual occurrences of recurring events

ALTER TABLE public.event_instances
  ADD COLUMN note TEXT,
  ADD COLUMN modified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX idx_event_instances_modified_by ON public.event_instances(modified_by);
