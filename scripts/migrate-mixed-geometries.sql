-- Allow KML polylines and points (not just polygons) in UploadGeometry.
-- Safe to re-run. Existing Polygon rows stay valid under Geometry.

ALTER TABLE "UploadGeometry"
  ALTER COLUMN geom TYPE geometry(Geometry, 4326)
  USING geom;

ALTER TABLE "UploadGeometry" ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE "UploadGeometry" ADD COLUMN IF NOT EXISTS "geomType" TEXT;

UPDATE "UploadGeometry"
SET "geomType" = REPLACE(ST_GeometryType(geom), 'ST_', '')
WHERE geom IS NOT NULL AND ("geomType" IS NULL OR "geomType" = '');
