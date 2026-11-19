-- Reverts RLS on `admin_login_failures`. Revoked anon/authenticated privileges are NOT restored (they should never have been there).
DO $$
BEGIN
  IF to_regclass('public.admin_login_failures') IS NOT NULL THEN EXECUTE 'ALTER TABLE public.admin_login_failures DISABLE ROW LEVEL SECURITY'; END IF;
END $$;
