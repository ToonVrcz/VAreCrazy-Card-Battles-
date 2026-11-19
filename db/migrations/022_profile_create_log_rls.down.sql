-- Reverts RLS on `profile_create_log`. Revoked anon/authenticated privileges are NOT restored (they should never have been there).
DO $$
BEGIN
  IF to_regclass('public.profile_create_log') IS NOT NULL THEN EXECUTE 'ALTER TABLE public.profile_create_log DISABLE ROW LEVEL SECURITY'; END IF;
END $$;
