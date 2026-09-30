-- Run after the base schema, before importing teachers through the Auth Admin API.
-- Compatible with either existing user_profiles definition. No Auth user is created here.
BEGIN;

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', 'user');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ordinary users must not promote themselves via the old profile UPDATE policy.
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
REVOKE UPDATE ON TABLE public.user_profiles FROM PUBLIC, anon, authenticated;

COMMIT;
