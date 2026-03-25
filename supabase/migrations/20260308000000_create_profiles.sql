-- Migration: Create profiles table
-- Phase: 3
-- Ticket: P3-01

-- Create table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX idx_profiles_role ON public.profiles(role);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- SELECT: users can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- SELECT: admins can read all profiles
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- INSERT: admins can insert profiles (auth trigger bypasses RLS via SECURITY DEFINER)
CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- UPDATE: users can update own profile but cannot change their role
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );

-- UPDATE: admins can update all profiles (including role)
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- DELETE: admins only
CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
