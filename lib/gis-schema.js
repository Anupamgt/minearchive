/**
 * Additive GIS columns/tables from prisma/sql/02_gis_attributes.sql.
 * Production was deployed with Prisma fields that the live DB did not have yet
 * (UploadGeometry.kmlType, AttributeChangeLog). Keep this in sync with that file.
 */

import { PrismaClient } from '@prisma/client';

let pending = null;
let applied = false;

const STATEMENTS = [
  `ALTER TABLE "UploadGeometry" ADD COLUMN IF NOT EXISTS "kmlType" TEXT`,
  `CREATE TABLE IF NOT EXISTS "AttributeChangeLog" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "siteCode" TEXT NOT NULL,
    "geometryId" TEXT NOT NULL,
    "fieldChanged" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS "AttributeChangeLog_siteCode_idx"
    ON "AttributeChangeLog" ("siteCode")`,
  `CREATE INDEX IF NOT EXISTS "AttributeChangeLog_geometryId_idx"
    ON "AttributeChangeLog" ("geometryId")`,
  `CREATE INDEX IF NOT EXISTS "AttributeChangeLog_changedAt_idx"
    ON "AttributeChangeLog" ("changedAt")`,
  `DO $$
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
END $$;`,
];

export async function applyGisAttributes(prisma) {
  for (const sql of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
  }
}

async function applyWithOptionalDirectUrl(prisma) {
  try {
    await applyGisAttributes(prisma);
    return;
  } catch (err) {
    const directUrl = process.env.DIRECT_URL;
    if (!directUrl || directUrl === process.env.DATABASE_URL) throw err;
    const direct = new PrismaClient({
      datasources: { db: { url: directUrl } },
    });
    try {
      await applyGisAttributes(direct);
    } finally {
      await direct.$disconnect().catch(() => {});
    }
  }
}

/**
 * Idempotent. Safe to call on every GIS request; no-ops after the first
 * success in this process.
 */
export async function ensureGisSchema(prisma) {
  if (applied) return;
  if (!pending) {
    pending = applyWithOptionalDirectUrl(prisma)
      .then(() => {
        applied = true;
      })
      .finally(() => {
        pending = null;
      });
  }
  await pending;
}
