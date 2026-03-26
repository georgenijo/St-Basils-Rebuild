-- Migration: Add unsubscribed_at to email_subscribers
-- Enables three-state subscriber tracking: unconfirmed / active / unsubscribed
-- Previously, unsubscribe nulled confirmed_at, making unsubscribed users
-- indistinguishable from those who never confirmed.

ALTER TABLE public.email_subscribers
  ADD COLUMN unsubscribed_at TIMESTAMPTZ;

CREATE INDEX idx_email_subscribers_unsubscribed_at
  ON public.email_subscribers(unsubscribed_at);
