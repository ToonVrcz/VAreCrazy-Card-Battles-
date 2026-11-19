-- Phase 1 Remediation: lock down `admin_login_failures` (created by migration 018) for the Supabase Data API (PostgREST).
-- Only the server (edge function, connecting with its own database role) may read or write it; anon / authenticated get nothing.
-- RLS is enabled with NO policies (deny by default); privileges are also revoked as defence in depth. Roles are optional so plain Postgres / PGlite still work.
-- Idempotent. Rows, constraints and indexes are untouched.
DO $$
BEGIN
  IF to_regclass('public.admin_login_failures') IS NULL THEN RETURN; END IF;
  EXECUTE 'ALTER TABLE public.admin_login_failures ENABLE ROW LEVEL SECURITY';
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE public.admin_login_failures FROM anon';
    EXECUTE 'REVOKE ALL ON SEQUENCE public.admin_login_failures_id_seq FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE public.admin_login_failures FROM authenticated';
    EXECUTE 'REVOKE ALL ON SEQUENCE public.admin_login_failures_id_seq FROM authenticated';
  END IF;
END $$;
