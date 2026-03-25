-- Migration: Create auth trigger for automatic profile creation
-- Phase: 3
-- Ticket: P3-02

-- Function: handle_new_user()
-- Automatically creates a profile row when a new user signs up via Supabase Auth.
-- Uses SECURITY DEFINER to bypass RLS (auth.users is not accessible to normal roles).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      ''
    ),
    'member',
    now(),
    now()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger: on_auth_user_created
-- Fires after a new row is inserted into auth.users (i.e., after signup).
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
