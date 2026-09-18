-- PostGIS catalog lock for Supabase.
--
-- public.spatial_ref_sys is owned by supabase_admin (the extension owner).
-- The SQL Editor runs as postgres, so this WILL fail:
--   ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
--   ERROR: 42501: must be owner of table spatial_ref_sys
--
-- That advisor warning is a known false positive: the table is EPSG codes,
-- not MineArchive data. You cannot enable RLS on it.
--
-- This script only revokes Data API roles when the current user is allowed
-- to. If REVOKE also fails, ignore the Security Advisor item.
--
-- Safe to re-run. Paste into SQL Editor → Run.

DO $$
DECLARE
  owner_name text;
BEGIN
  IF to_regclass('public.spatial_ref_sys') IS NULL THEN
    RAISE NOTICE 'public.spatial_ref_sys not found — skip';
    RETURN;
  END IF;

  SELECT pg_get_userbyid(c.relowner) INTO owner_name
  FROM pg_class c
  WHERE c.oid = 'public.spatial_ref_sys'::regclass;

  RAISE NOTICE 'spatial_ref_sys owner is %; session user is %', owner_name, current_user;

  -- Revoke Data API access. May still fail if postgres did not grant these
  -- privileges; catch so the rest of setup is not aborted.
  BEGIN
    EXECUTE 'REVOKE ALL ON TABLE public.spatial_ref_sys FROM anon';
    RAISE NOTICE 'revoked anon';
  EXCEPTION WHEN insufficient_privilege OR OTHERS THEN
    RAISE NOTICE 'revoke anon skipped: %', SQLERRM;
  END;

  BEGIN
    EXECUTE 'REVOKE ALL ON TABLE public.spatial_ref_sys FROM authenticated';
    RAISE NOTICE 'revoked authenticated';
  EXCEPTION WHEN insufficient_privilege OR OTHERS THEN
    RAISE NOTICE 'revoke authenticated skipped: %', SQLERRM;
  END;

  -- ENABLE RLS only when we own the table (local Docker). Skip on Supabase.
  IF owner_name = current_user THEN
    EXECUTE 'ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY';
    RAISE NOTICE 'RLS enabled';
  ELSE
    RAISE NOTICE 'skip ENABLE RLS — not the owner (normal on hosted Supabase)';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
