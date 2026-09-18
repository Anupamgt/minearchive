#!/usr/bin/env node
/**
 * Apply mixed-geometry UploadGeometry columns against DATABASE_URL / DIRECT_URL.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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

const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.warn('DATABASE_URL / DIRECT_URL not set — skipping mixed-geometry migration.');
  process.exit(0);
}

const prisma = new PrismaClient({
  datasources: { db: { url: databaseUrl } },
});

const statements = [
  `ALTER TABLE "UploadGeometry"
     ALTER COLUMN geom TYPE geometry(Geometry, 4326)
     USING geom`,
  `ALTER TABLE "UploadGeometry" ADD COLUMN IF NOT EXISTS name TEXT`,
  `ALTER TABLE "UploadGeometry" ADD COLUMN IF NOT EXISTS "geomType" TEXT`,
  `UPDATE "UploadGeometry"
     SET "geomType" = REPLACE(ST_GeometryType(geom), 'ST_', '')
     WHERE geom IS NOT NULL AND ("geomType" IS NULL OR "geomType" = '')`,
];

try {
  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
  }
  console.log('✔ Mixed-geometry migration applied.');
} catch (err) {
  console.error('✖ Mixed-geometry migration failed:', err.message);
  process.exit(1);
} finally {
  await prisma.$disconnect().catch(() => {});
}
