-- Seed: Initial admin user
-- Phase: 3
-- Ticket: P3-08
--
-- This seed runs after all migrations via `supabase db reset` (local dev).
-- Requires: P3-02 (profiles table + auth trigger)
--
-- For PRODUCTION, do NOT use this file. Follow the manual process below.

-- =============================================================================
-- LOCAL DEVELOPMENT SEED
-- =============================================================================
-- Creates a test admin user for local development.
-- Email: admin@stbasilsboston.org
-- Password: admin123456
--
-- After `supabase db reset`, log in with these credentials at /login.
-- =============================================================================

-- 1. Create auth user
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
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'authenticated',
  'authenticated',
  'admin@stbasilsboston.org',
  crypt('admin123456', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Site Admin"}',
  now(),
  now(),
  '',
  ''
);

-- 2. Create identity record (required for email/password login)
INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'admin@stbasilsboston.org',
  jsonb_build_object(
    'sub', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'email', 'admin@stbasilsboston.org',
    'email_verified', true
  ),
  'email',
  now(),
  now(),
  now()
);

-- 3. Promote to admin
--    The auth trigger (P3-02) auto-creates a profile row on user signup.
--    This UPDATE sets that profile's role to 'admin'.
UPDATE public.profiles
SET role = 'admin'
WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- =============================================================================
-- PRODUCTION: Manual admin creation process
-- =============================================================================
--
-- Step 1: Create the user
--   Option A — Supabase Dashboard:
--     1. Go to Authentication > Users in your Supabase project dashboard
--     2. Click "Add user" > "Create new user"
--     3. Enter the admin's email and a strong password
--     4. Check "Auto Confirm User" so they can log in immediately
--
--   Option B — Supabase Auth Admin API (from a server/Edge Function):
--     const { data, error } = await supabase.auth.admin.createUser({
--       email: 'admin@stbasilsboston.org',
--       password: 'secure-password-here',
--       email_confirm: true,
--       user_metadata: { full_name: 'Admin Name' }
--     })
--
-- Step 2: Promote to admin
--   Run this SQL in the Supabase SQL Editor (replace the UUID):
--
--     UPDATE public.profiles
--     SET role = 'admin'
--     WHERE id = '<user-uuid-from-step-1>';
--
--   To find the user's UUID:
--     SELECT id, email FROM auth.users WHERE email = 'admin@stbasilsboston.org';
--
-- Step 3: Verify
--   1. Log in at /login with the admin credentials
--   2. Navigate to /admin/dashboard — should load without redirect
--   3. Confirm the profile:
--      SELECT id, email, role FROM public.profiles WHERE role = 'admin';
--
-- =============================================================================
-- ADDING FUTURE ADMINS
-- =============================================================================
--
-- Any existing admin can promote other users by running:
--
--   UPDATE public.profiles
--   SET role = 'admin'
--   WHERE email = 'new-admin@example.com';
--
-- The user must already have a Supabase Auth account (created via signup or
-- the dashboard). The auth trigger auto-creates their profile row.
--
-- To revoke admin access:
--
--   UPDATE public.profiles
--   SET role = 'member'
--   WHERE email = 'former-admin@example.com';
--
-- =============================================================================
