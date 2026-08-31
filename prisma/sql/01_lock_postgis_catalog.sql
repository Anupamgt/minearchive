-- Lock PostGIS catalog tables so the Supabase Data API (PostgREST) cannot
-- read them. Clears Security Advisor: "RLS Disabled in Public" on
-- public.spatial_ref_sys.
--
-- spatial_ref_sys is the EPSG catalog PostGIS ships — not MineArchive data.
-- The app uses Prisma as the database owner, not the anon key.
--
-- Paste into Supabase → SQL Editor → Run. Safe to re-run.
-- Do NOT FORCE ROW LEVEL SECURITY (owner must keep ST_Transform working).

DO $$
BEGIN
  IF to_regclass('public.spatial_ref_sys') IS NULL THEN
    RAISE NOTICE 'public.spatial_ref_sys not found — skip';
    RETURN;
  END IF;

  EXECUTE 'REVOKE ALL ON TABLE public.spatial_ref_sys FROM PUBLIC';

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE public.spatial_ref_sys FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE public.spatial_ref_sys FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    EXECUTE 'GRANT SELECT ON TABLE public.spatial_ref_sys TO postgres';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT SELECT ON TABLE public.spatial_ref_sys TO service_role';
  END IF;

  EXECUTE 'ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY';

  IF to_regclass('public.geometry_columns') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public.geometry_columns FROM PUBLIC';
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE 'REVOKE ALL ON TABLE public.geometry_columns FROM anon';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE 'REVOKE ALL ON TABLE public.geometry_columns FROM authenticated';
    END IF;
  END IF;

  IF to_regclass('public.geography_columns') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public.geography_columns FROM PUBLIC';
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE 'REVOKE ALL ON TABLE public.geography_columns FROM anon';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE 'REVOKE ALL ON TABLE public.geography_columns FROM authenticated';
    END IF;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
