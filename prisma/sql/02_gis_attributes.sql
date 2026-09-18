-- GIS attribute table + Maps activity log (Workstreams A–B).
-- Also widens geom to Geometry so polylines and points can be stored.
-- The app also applies this on GIS API requests (`lib/gis-schema.js`)
-- and via `npm run db:gis`. Safe to re-run.
-- Use the direct connection (port 5432) if you run this via psql.
--
-- Does NOT drop UserSiteAssignment.
-- Does NOT enable RLS on spatial_ref_sys (PostGIS catalog — leave it alone).

ALTER TABLE "UploadGeometry"
  ALTER COLUMN geom TYPE geometry(Geometry, 4326)
  USING geom;

ALTER TABLE "UploadGeometry" ADD COLUMN IF NOT EXISTS "kmlType" TEXT;
ALTER TABLE "UploadGeometry" ADD COLUMN IF NOT EXISTS "geomType" TEXT;

CREATE TABLE IF NOT EXISTS "AttributeChangeLog" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "siteCode" TEXT NOT NULL,
  "geometryId" TEXT NOT NULL,
  "fieldChanged" TEXT NOT NULL,
  "oldValue" TEXT,
  "newValue" TEXT,
  "changedBy" TEXT NOT NULL,
  "changedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "AttributeChangeLog_siteCode_idx"
  ON "AttributeChangeLog" ("siteCode");
CREATE INDEX IF NOT EXISTS "AttributeChangeLog_geometryId_idx"
  ON "AttributeChangeLog" ("geometryId");
CREATE INDEX IF NOT EXISTS "AttributeChangeLog_changedAt_idx"
  ON "AttributeChangeLog" ("changedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AttributeChangeLog_geometryId_fkey'
  ) THEN
    ALTER TABLE "AttributeChangeLog"
      ADD CONSTRAINT "AttributeChangeLog_geometryId_fkey"
      FOREIGN KEY ("geometryId") REFERENCES "UploadGeometry"("id")
      ON DELETE CASCADE;
  END IF;
END $$;
