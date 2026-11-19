-- Phase 1 Remediation: lock down `profile_create_log` (created by migration 021) for the Supabase Data API (PostgREST).
-- Only the server (edge function, connecting with its own database role) may read or write it; anon / authenticated get nothing.
-- RLS is enabled with NO policies (deny by default); privileges are also revoked as defence in depth. Roles are optional so plain Postgres / PGlite still work.
-- Idempotent. Rows, constraints and indexes are untouched.
DO $$
BEGIN
  IF to_regclass('public.profile_create_log') IS NULL THEN RETURN; END IF;
  EXECUTE 'ALTER TABLE public.profile_create_log ENABLE ROW LEVEL SECURITY';
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE public.profile_create_log FROM anon';
    EXECUTE 'REVOKE ALL ON SEQUENCE public.profile_create_log_id_seq FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE public.profile_create_log FROM authenticated';
    EXECUTE 'REVOKE ALL ON SEQUENCE public.profile_create_log_id_seq FROM authenticated';
  END IF;
END $$;
