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
  email_change,
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

-- ─── Seed Events ──────────────────────────────────────────────────────
-- Phase: 4b
-- Ticket: 4b-01
--
-- Seeds recurring Sunday services and liturgical events from the
-- existing hardcoded calendar (events-calendar.html, 2024-2026).
-- All events are created_by the seeded admin user.

-- ── Recurring: Sunday Morning Prayer ──────────────────────────────────

INSERT INTO public.events (id, title, slug, description, location, start_at, end_at, is_recurring, category, created_by)
VALUES (
  '11111111-1111-1111-1111-111111111101',
  'Morning Prayer',
  'sunday-morning-prayer',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Weekly Sunday morning prayer service."}]}]}'::jsonb,
  'St. Basil''s Syriac Orthodox Church, 73 Ellis Street, Newton, MA 02464',
  '2024-01-07T08:30:00-05:00',
  '2024-01-07T09:15:00-05:00',
  true,
  'liturgical',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
);

INSERT INTO public.recurrence_rules (id, event_id, rrule_string, dtstart)
VALUES (
  '22222222-2222-2222-2222-222222222201',
  '11111111-1111-1111-1111-111111111101',
  'FREQ=WEEKLY;BYDAY=SU',
  '2024-01-07T08:30:00-05:00'
);

-- ── Recurring: Sunday Holy Qurbono ────────────────────────────────────

INSERT INTO public.events (id, title, slug, description, location, start_at, end_at, is_recurring, category, created_by)
VALUES (
  '11111111-1111-1111-1111-111111111102',
  'Holy Qurbono',
  'sunday-holy-qurbono',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Weekly Sunday Holy Qurbono (Divine Liturgy)."}]}]}'::jsonb,
  'St. Basil''s Syriac Orthodox Church, 73 Ellis Street, Newton, MA 02464',
  '2024-01-07T09:15:00-05:00',
  '2024-01-07T11:00:00-05:00',
  true,
  'liturgical',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
);

INSERT INTO public.recurrence_rules (id, event_id, rrule_string, dtstart)
VALUES (
  '22222222-2222-2222-2222-222222222202',
  '11111111-1111-1111-1111-111111111102',
  'FREQ=WEEKLY;BYDAY=SU',
  '2024-01-07T09:15:00-05:00'
);

-- ── Recurring Annual: Christmas ───────────────────────────────────────

INSERT INTO public.events (id, title, slug, description, location, start_at, end_at, is_recurring, category, created_by)
VALUES (
  '11111111-1111-1111-1111-111111111103',
  'Christmas — Nativity of Our Lord',
  'christmas',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Celebration of the Nativity of Our Lord Jesus Christ."}]}]}'::jsonb,
  'St. Basil''s Syriac Orthodox Church, 73 Ellis Street, Newton, MA 02464',
  '2024-12-25T09:00:00-05:00',
  '2024-12-25T12:00:00-05:00',
  true,
  'liturgical',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
);

INSERT INTO public.recurrence_rules (id, event_id, rrule_string, dtstart)
VALUES (
  '22222222-2222-2222-2222-222222222203',
  '11111111-1111-1111-1111-111111111103',
  'FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=25',
  '2024-12-25T09:00:00-05:00'
);

-- ── Recurring Annual: Circumcision of Christ / New Year ───────────────

INSERT INTO public.events (id, title, slug, description, location, start_at, end_at, is_recurring, category, created_by)
VALUES (
  '11111111-1111-1111-1111-111111111104',
  'Circumcision of Christ',
  'circumcision-of-christ',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Feast of the Circumcision of Our Lord."}]}]}'::jsonb,
  'St. Basil''s Syriac Orthodox Church, 73 Ellis Street, Newton, MA 02464',
  '2025-01-01T09:00:00-05:00',
  '2025-01-01T12:00:00-05:00',
  true,
  'liturgical',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
);

INSERT INTO public.recurrence_rules (id, event_id, rrule_string, dtstart)
VALUES (
  '22222222-2222-2222-2222-222222222204',
  '11111111-1111-1111-1111-111111111104',
  'FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1',
  '2025-01-01T09:00:00-05:00'
);

-- ── Recurring Annual: Denho / Epiphany ────────────────────────────────

INSERT INTO public.events (id, title, slug, description, location, start_at, end_at, is_recurring, category, created_by)
VALUES (
  '11111111-1111-1111-1111-111111111105',
  'Denho (Epiphany)',
  'denho-epiphany',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Feast of Denho — the Baptism of Our Lord (Epiphany)."}]}]}'::jsonb,
  'St. Basil''s Syriac Orthodox Church, 73 Ellis Street, Newton, MA 02464',
  '2025-01-06T09:00:00-05:00',
  '2025-01-06T12:00:00-05:00',
  true,
  'liturgical',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
);

INSERT INTO public.recurrence_rules (id, event_id, rrule_string, dtstart)
VALUES (
  '22222222-2222-2222-2222-222222222205',
  '11111111-1111-1111-1111-111111111105',
  'FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=6',
  '2025-01-06T09:00:00-05:00'
);

-- ── Recurring Annual: Annunciation ────────────────────────────────────

INSERT INTO public.events (id, title, slug, description, location, start_at, end_at, is_recurring, category, created_by)
VALUES (
  '11111111-1111-1111-1111-111111111106',
  'Annunciation to the Blessed Virgin Mary',
  'annunciation',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Feast of the Annunciation to the Blessed Virgin Mary."}]}]}'::jsonb,
  'St. Basil''s Syriac Orthodox Church, 73 Ellis Street, Newton, MA 02464',
  '2025-03-25T09:00:00-04:00',
  '2025-03-25T12:00:00-04:00',
  true,
  'liturgical',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
);

INSERT INTO public.recurrence_rules (id, event_id, rrule_string, dtstart)
VALUES (
  '22222222-2222-2222-2222-222222222206',
  '11111111-1111-1111-1111-111111111106',
  'FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=25',
  '2025-03-25T09:00:00-04:00'
);

-- ── Recurring Annual: Feast of the Apostles ───────────────────────────

INSERT INTO public.events (id, title, slug, description, location, start_at, end_at, is_recurring, category, created_by)
VALUES (
  '11111111-1111-1111-1111-111111111107',
  'Feast of the Holy Apostles',
  'feast-of-the-apostles',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Feast of the Holy Apostles Peter and Paul."}]}]}'::jsonb,
  'St. Basil''s Syriac Orthodox Church, 73 Ellis Street, Newton, MA 02464',
  '2025-06-29T09:00:00-04:00',
  '2025-06-29T12:00:00-04:00',
  true,
  'liturgical',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
);

INSERT INTO public.recurrence_rules (id, event_id, rrule_string, dtstart)
VALUES (
  '22222222-2222-2222-2222-222222222207',
  '11111111-1111-1111-1111-111111111107',
  'FREQ=YEARLY;BYMONTH=6;BYMONTHDAY=29',
  '2025-06-29T09:00:00-04:00'
);

-- ── Recurring Annual: Transfiguration ─────────────────────────────────

INSERT INTO public.events (id, title, slug, description, location, start_at, end_at, is_recurring, category, created_by)
VALUES (
  '11111111-1111-1111-1111-111111111108',
  'Transfiguration of Our Lord',
  'transfiguration',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Feast of the Transfiguration of Our Lord on Mount Tabor."}]}]}'::jsonb,
  'St. Basil''s Syriac Orthodox Church, 73 Ellis Street, Newton, MA 02464',
  '2025-08-06T09:00:00-04:00',
  '2025-08-06T12:00:00-04:00',
  true,
  'liturgical',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
);

INSERT INTO public.recurrence_rules (id, event_id, rrule_string, dtstart)
VALUES (
  '22222222-2222-2222-2222-222222222208',
  '11111111-1111-1111-1111-111111111108',
  'FREQ=YEARLY;BYMONTH=8;BYMONTHDAY=6',
  '2025-08-06T09:00:00-04:00'
);

-- ── Recurring Annual: Assumption of the Blessed Virgin Mary ───────────

INSERT INTO public.events (id, title, slug, description, location, start_at, end_at, is_recurring, category, created_by)
VALUES (
  '11111111-1111-1111-1111-111111111109',
  'Assumption of the Blessed Virgin Mary',
  'assumption',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Feast of the Assumption (Shunaya) of the Blessed Virgin Mary."}]}]}'::jsonb,
  'St. Basil''s Syriac Orthodox Church, 73 Ellis Street, Newton, MA 02464',
  '2025-08-15T09:00:00-04:00',
  '2025-08-15T12:00:00-04:00',
  true,
  'liturgical',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
);

INSERT INTO public.recurrence_rules (id, event_id, rrule_string, dtstart)
VALUES (
  '22222222-2222-2222-2222-222222222209',
  '11111111-1111-1111-1111-111111111109',
  'FREQ=YEARLY;BYMONTH=8;BYMONTHDAY=15',
  '2025-08-15T09:00:00-04:00'
);

-- ── Recurring Annual: Nativity of the Blessed Virgin Mary ─────────────

INSERT INTO public.events (id, title, slug, description, location, start_at, end_at, is_recurring, category, created_by)
VALUES (
  '11111111-1111-1111-1111-111111111110',
  'Nativity of the Blessed Virgin Mary',
  'nativity-of-st-mary',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Feast of the Nativity of the Blessed Virgin Mary."}]}]}'::jsonb,
  'St. Basil''s Syriac Orthodox Church, 73 Ellis Street, Newton, MA 02464',
  '2025-09-08T09:00:00-04:00',
  '2025-09-08T12:00:00-04:00',
  true,
  'liturgical',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
);

INSERT INTO public.recurrence_rules (id, event_id, rrule_string, dtstart)
VALUES (
  '22222222-2222-2222-2222-222222222210',
  '11111111-1111-1111-1111-111111111110',
  'FREQ=YEARLY;BYMONTH=9;BYMONTHDAY=8',
  '2025-09-08T09:00:00-04:00'
);

-- ── Recurring Annual: Nativity Lent ───────────────────────────────────

INSERT INTO public.events (id, title, slug, description, location, start_at, end_at, is_recurring, category, created_by)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Nativity Lent',
  'nativity-lent',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Nativity Lent (December 15–24) — period of fasting and preparation for the feast of the Nativity."}]}]}'::jsonb,
  'St. Basil''s Syriac Orthodox Church, 73 Ellis Street, Newton, MA 02464',
  '2024-12-15T00:00:00-05:00',
  '2024-12-24T23:59:59-05:00',
  true,
  'liturgical',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
);

INSERT INTO public.recurrence_rules (id, event_id, rrule_string, dtstart)
VALUES (
  '22222222-2222-2222-2222-222222222211',
  '11111111-1111-1111-1111-111111111111',
  'FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=15',
  '2024-12-15T00:00:00-05:00'
);

-- ── One-Time: Church Perunnal 2025 ────────────────────────────────────

INSERT INTO public.events (id, title, slug, description, location, start_at, end_at, is_recurring, category, created_by)
VALUES (
  '11111111-1111-1111-1111-111111111112',
  'Church Perunnal',
  'church-perunnal-2025',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Annual parish feast (Perunnal) of St. Basil''s Syriac Orthodox Church."}]}]}'::jsonb,
  'St. Basil''s Syriac Orthodox Church, 73 Ellis Street, Newton, MA 02464',
  '2025-09-27T09:00:00-04:00',
  '2025-09-28T17:00:00-04:00',
  false,
  'special',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
);

-- ── One-Time: Great Lent 2026 ─────────────────────────────────────────

INSERT INTO public.events (id, title, slug, description, location, start_at, end_at, is_recurring, category, created_by)
VALUES (
  '11111111-1111-1111-1111-111111111113',
  'Great Lent',
  'great-lent-2026',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"The Great Lent — 50-day fasting period leading up to Easter."}]}]}'::jsonb,
  'St. Basil''s Syriac Orthodox Church, 73 Ellis Street, Newton, MA 02464',
  '2026-02-16T00:00:00-05:00',
  '2026-04-04T23:59:59-04:00',
  false,
  'liturgical',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
);

-- ── One-Time: Palm Sunday 2026 ────────────────────────────────────────

INSERT INTO public.events (id, title, slug, description, location, start_at, end_at, is_recurring, category, created_by)
VALUES (
  '11111111-1111-1111-1111-111111111114',
  'Palm Sunday (Hosanna)',
  'palm-sunday-2026',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Palm Sunday — commemorating the triumphant entry of Our Lord into Jerusalem."}]}]}'::jsonb,
  'St. Basil''s Syriac Orthodox Church, 73 Ellis Street, Newton, MA 02464',
  '2026-03-29T08:30:00-04:00',
  '2026-03-29T12:00:00-04:00',
  false,
  'liturgical',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
);

-- ── One-Time: Holy Thursday 2026 ──────────────────────────────────────

INSERT INTO public.events (id, title, slug, description, location, start_at, end_at, is_recurring, category, created_by)
VALUES (
  '11111111-1111-1111-1111-111111111115',
  'Holy Thursday',
  'holy-thursday-2026',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Holy Thursday — commemoration of the Last Supper and the Washing of Feet."}]}]}'::jsonb,
  'St. Basil''s Syriac Orthodox Church, 73 Ellis Street, Newton, MA 02464',
  '2026-04-02T18:00:00-04:00',
  '2026-04-02T21:00:00-04:00',
  false,
  'liturgical',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
);

-- ── One-Time: Good Friday 2026 ────────────────────────────────────────

INSERT INTO public.events (id, title, slug, description, location, start_at, end_at, is_recurring, category, created_by)
VALUES (
  '11111111-1111-1111-1111-111111111116',
  'Good Friday',
  'good-friday-2026',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Good Friday — solemn commemoration of the Crucifixion of Our Lord."}]}]}'::jsonb,
  'St. Basil''s Syriac Orthodox Church, 73 Ellis Street, Newton, MA 02464',
  '2026-04-03T09:00:00-04:00',
  '2026-04-03T15:00:00-04:00',
  false,
  'liturgical',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
);

-- ── One-Time: Holy Saturday 2026 ──────────────────────────────────────

INSERT INTO public.events (id, title, slug, description, location, start_at, end_at, is_recurring, category, created_by)
VALUES (
  '11111111-1111-1111-1111-111111111117',
  'Holy Saturday',
  'holy-saturday-2026',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Holy Saturday — the day of rest and waiting before the Resurrection."}]}]}'::jsonb,
  'St. Basil''s Syriac Orthodox Church, 73 Ellis Street, Newton, MA 02464',
  '2026-04-04T18:00:00-04:00',
  '2026-04-04T22:00:00-04:00',
  false,
  'liturgical',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
);

-- ── One-Time: Easter 2026 ─────────────────────────────────────────────

INSERT INTO public.events (id, title, slug, description, location, start_at, end_at, is_recurring, category, created_by)
VALUES (
  '11111111-1111-1111-1111-111111111118',
  'Easter — Resurrection of Our Lord',
  'easter-2026',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Easter — the glorious Resurrection of Our Lord Jesus Christ."}]}]}'::jsonb,
  'St. Basil''s Syriac Orthodox Church, 73 Ellis Street, Newton, MA 02464',
  '2026-04-05T06:00:00-04:00',
  '2026-04-05T12:00:00-04:00',
  false,
  'liturgical',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
);

-- ── One-Time: Ascension 2026 ──────────────────────────────────────────

INSERT INTO public.events (id, title, slug, description, location, start_at, end_at, is_recurring, category, created_by)
VALUES (
  '11111111-1111-1111-1111-111111111119',
  'Ascension of Our Lord',
  'ascension-2026',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Feast of the Ascension of Our Lord — 40 days after Easter."}]}]}'::jsonb,
  'St. Basil''s Syriac Orthodox Church, 73 Ellis Street, Newton, MA 02464',
  '2026-05-14T09:00:00-04:00',
  '2026-05-14T12:00:00-04:00',
  false,
  'liturgical',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
);

-- ── One-Time: Pentecost 2026 ──────────────────────────────────────────

INSERT INTO public.events (id, title, slug, description, location, start_at, end_at, is_recurring, category, created_by)
VALUES (
  '11111111-1111-1111-1111-111111111120',
  'Pentecost',
  'pentecost-2026',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Feast of Pentecost — the descent of the Holy Spirit upon the Apostles, 50 days after Easter."}]}]}'::jsonb,
  'St. Basil''s Syriac Orthodox Church, 73 Ellis Street, Newton, MA 02464',
  '2026-05-24T09:00:00-04:00',
  '2026-05-24T12:00:00-04:00',
  false,
  'liturgical',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
);
