-- Seed: Initial admin user for local development
-- Phase: 3
-- Ticket: P3-08
--
-- Usage: Runs automatically during `supabase db reset`.
-- Login: admin@stbasilsboston.org / admin123
--
-- ─── Production Admin Setup ──────────────────────────────────────────
--
-- In production, admin users are created in two steps:
--
-- 1. The user signs up normally (or is invited via the Supabase Auth
--    dashboard under Authentication → Users → Invite user).
--    The on_auth_user_created trigger (P3-02) auto-creates a profile
--    row with role = 'member'.
--
-- 2. Promote the user to admin via the Supabase SQL Editor:
--
--    UPDATE public.profiles
--    SET role = 'admin', updated_at = now()
--    WHERE email = 'newadmin@example.com';
--
-- For the very first admin (bootstrapping), run the UPDATE above
-- directly in the Supabase SQL Editor after the user has signed up.
--
-- To verify the promotion worked:
--
--    SELECT id, email, full_name, role FROM public.profiles
--    WHERE email = 'newadmin@example.com';
--
-- The promoted user can now log in and access /admin/dashboard.
--
-- ─────────────────────────────────────────────────────────────────────

-- ─── Test Admin User ─────────────────────────────────────────────────
-- Creates a pre-confirmed admin user for local development.
-- The on_auth_user_created trigger (P3-02) auto-creates a profile row
-- with role = 'member', then we promote that profile to admin.

-- Step 1: Create the auth user
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'authenticated',
  'authenticated',
  'admin@stbasilsboston.org',
  crypt('admin123', gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"full_name": "Parish Admin"}'::jsonb,
  now(),
  now(),
  '',
  '',
  ''
);

-- Step 2: Create the identity record (required for email/password login)
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  jsonb_build_object(
    'sub', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'email', 'admin@stbasilsboston.org',
    'email_verified', true
  ),
  'email',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  now(),
  now(),
  now()
);

-- Step 3: Promote to admin
-- The trigger created a profile with role = 'member'; now upgrade it.
UPDATE public.profiles
SET role = 'admin', updated_at = now()
WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
