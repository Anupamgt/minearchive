#!/usr/bin/env node
/**
 * Apply prisma/sql/02_gis_attributes.sql (UploadGeometry.kmlType + AttributeChangeLog).
 *
 * Usage: npm run db:gis
 *
 * Prefers DIRECT_URL (port 5432). Safe to re-run.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(resolve(root, '.env.local'));
loadEnvFile(resolve(root, '.env'));

/** Keep in sync with lib/gis-schema.js and prisma/sql/02_gis_attributes.sql */
export async function applyGisAttributes(prisma) {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "UploadGeometry" ADD COLUMN IF NOT EXISTS "kmlType" TEXT`
  );
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AttributeChangeLog" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "siteCode" TEXT NOT NULL,
      "geometryId" TEXT NOT NULL,
      "fieldChanged" TEXT NOT NULL,
      "oldValue" TEXT,
      "newValue" TEXT,
      "changedBy" TEXT NOT NULL,
      "changedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AttributeChangeLog_siteCode_idx"
      ON "AttributeChangeLog" ("siteCode")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AttributeChangeLog_geometryId_idx"
      ON "AttributeChangeLog" ("geometryId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AttributeChangeLog_changedAt_idx"
      ON "AttributeChangeLog" ("changedAt")
  `);
  await prisma.$executeRawUnsafe(`
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
  `);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!directUrl) {
    console.error(
      'DIRECT_URL / DATABASE_URL is not set.\n' +
        '  Put the production connection string in .env.local, or paste\n' +
        '  prisma/sql/02_gis_attributes.sql into the SQL editor.'
    );
    process.exit(1);
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: directUrl } },
  });

  try {
    console.log('→ Applying GIS attributes (kmlType + AttributeChangeLog)…');
    await applyGisAttributes(prisma);
    console.log('✔ UploadGeometry.kmlType and AttributeChangeLog are ready.');
  } catch (err) {
    console.error(`✖ ${err.message}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}
