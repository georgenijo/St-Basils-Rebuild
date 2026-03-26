-- Migration: Create announcements table
-- Phase: 4c
-- Ticket: 4c-01

-- ─── Announcements Table ─────────────────────────────────────────────

CREATE TABLE public.announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  body JSONB,
  priority INTEGER NOT NULL DEFAULT 0,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  send_email BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX idx_announcements_slug ON public.announcements(slug);
CREATE INDEX idx_announcements_is_pinned ON public.announcements(is_pinned);
CREATE INDEX idx_announcements_priority ON public.announcements(priority);
CREATE INDEX idx_announcements_published_at ON public.announcements(published_at);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- SELECT: public can read published, non-expired announcements
CREATE POLICY "Public can read published announcements"
  ON public.announcements FOR SELECT
  TO anon, authenticated
  USING (
    published_at IS NOT NULL
    AND (expires_at IS NULL OR expires_at > now())
  );

-- SELECT: admins can read all announcements (including drafts and expired)
CREATE POLICY "Admins can read all announcements"
  ON public.announcements FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- INSERT: admins only
CREATE POLICY "Admins can insert announcements"
  ON public.announcements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- UPDATE: admins only
CREATE POLICY "Admins can update announcements"
  ON public.announcements FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- DELETE: admins only
CREATE POLICY "Admins can delete announcements"
  ON public.announcements FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Auto-update updated_at
CREATE TRIGGER set_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
