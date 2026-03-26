-- Migration: Create email_subscribers table
-- Phase: 4d
-- Ticket: 4d-01 (created as dependency for 4c-04)

-- ─── Email Subscribers Table ────────────────────────────────────────

CREATE TABLE public.email_subscribers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  confirmed BOOLEAN NOT NULL DEFAULT false,
  confirmed_at TIMESTAMPTZ,
  unsubscribe_token UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX idx_email_subscribers_confirmed ON public.email_subscribers(confirmed);
CREATE INDEX idx_email_subscribers_unsubscribe_token ON public.email_subscribers(unsubscribe_token);

-- Enable RLS
ALTER TABLE public.email_subscribers ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- SELECT: admins only
CREATE POLICY "Admins can read subscribers"
  ON public.email_subscribers FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- INSERT: anonymous can subscribe (public signup form)
CREATE POLICY "Anyone can subscribe"
  ON public.email_subscribers FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- UPDATE: admins only (for confirming, etc.)
CREATE POLICY "Admins can update subscribers"
  ON public.email_subscribers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- DELETE: admins only
CREATE POLICY "Admins can delete subscribers"
  ON public.email_subscribers FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Auto-update updated_at
CREATE TRIGGER set_email_subscribers_updated_at
  BEFORE UPDATE ON public.email_subscribers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
