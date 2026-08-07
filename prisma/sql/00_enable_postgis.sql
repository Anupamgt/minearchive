-- Run against the Supabase *direct* connection (port 5432), not the transaction pooler.
-- MineArchive stores KML polygons in UploadGeometry.geom (geometry(Polygon, 4326)).

CREATE EXTENSION IF NOT EXISTS postgis;

-- Optional spatial index helper (safe if table does not exist yet — Prisma creates tables)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'UploadGeometry'
  ) THEN
    CREATE INDEX IF NOT EXISTS upload_geometry_geom_idx
      ON "UploadGeometry"
      USING GIST (geom);
  END IF;
END $$;
