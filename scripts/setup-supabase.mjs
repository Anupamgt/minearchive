#!/usr/bin/env node
/**
 * Provision MineArchive schema on Supabase Postgres + PostGIS.
 *
 * Required env (from Supabase → Project Settings → Database):
 *   DIRECT_URL   — direct/session connection (port 5432), used for extensions + prisma
 *   DATABASE_URL — pooled connection (port 6543, ?pgbouncer=true&connection_limit=1)
 *
 * Optional:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — for Storage client
 *
 * Usage:
 *   cp .env.example .env.local   # fill URLs
 *   npm run db:supabase
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { lockPostgisCatalog } from './lock-postgis-catalog.mjs';

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

const databaseUrl = process.env.DATABASE_URL;
const directUrl = process.env.DIRECT_URL || databaseUrl;

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

if (!databaseUrl) {
  fail(
    'DATABASE_URL is not set.\n' +
      '  1. Create a free project at https://supabase.com/dashboard\n' +
      '  2. Project Settings → Database → copy connection strings\n' +
      '  3. Put them in .env.local (see .env.example)\n' +
      '  4. Re-run: npm run db:supabase'
  );
}

if (!process.env.DIRECT_URL) {
  console.warn(
    '⚠ DIRECT_URL is unset — using DATABASE_URL for migrations.\n' +
      '  For Supabase, set DIRECT_URL to the direct (port 5432) connection string.'
  );
}

// Prefer direct URL for DDL / extensions (pooler can reject CREATE EXTENSION)
process.env.DATABASE_URL = directUrl;
process.env.DIRECT_URL = directUrl;

console.log('→ Connecting with direct URL (host redacted)…');
const redacted = directUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
console.log(`  ${redacted}`);

const prisma = new PrismaClient({
  datasources: { db: { url: directUrl } },
});

try {
  console.log('→ Enabling PostGIS extension…');
  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS postgis;');

  const rows = await prisma.$queryRawUnsafe('SELECT PostGIS_Version() AS version;');
  const version = rows?.[0]?.version || 'unknown';
  console.log(`  PostGIS OK (${version})`);

  console.log('→ Locking PostGIS catalog from the Data API…');
  try {
    await lockPostgisCatalog(prisma);
    console.log('  spatial_ref_sys RLS enabled');
  } catch (lockErr) {
    console.warn(`  Catalog lock skipped: ${lockErr.message}`);
  }
} catch (err) {
  await prisma.$disconnect().catch(() => {});
  fail(
    `Could not enable PostGIS: ${err.message}\n` +
      '  Make sure you are using the *direct* DB URL (port 5432), not the transaction pooler (6543).\n' +
      '  In Supabase SQL editor you can also run: CREATE EXTENSION IF NOT EXISTS postgis;'
  );
} finally {
  await prisma.$disconnect().catch(() => {});
}

console.log('→ Pushing Prisma schema (tables)…');
const push = spawnSync(
  'npx',
  ['prisma', 'db', 'push', '--skip-generate'],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: directUrl,
      DIRECT_URL: directUrl,
    },
  }
);

if (push.status !== 0) {
  fail('prisma db push failed. See output above.');
}

// Spatial index (after table exists)
const prisma2 = new PrismaClient({
  datasources: { db: { url: directUrl } },
});
try {
  console.log('→ Ensuring GIST index on UploadGeometry.geom…');
  await prisma2.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS upload_geometry_geom_idx
      ON "UploadGeometry"
      USING GIST (geom);
  `);
  console.log('  Index OK');
} catch (err) {
  console.warn(`  Index skipped: ${err.message}`);
} finally {
  await prisma2.$disconnect().catch(() => {});
}

console.log(`
✔ Supabase database is ready for MineArchive.

Next:
  • Keep DATABASE_URL = pooled (:6543?pgbouncer=true&connection_limit=1)
  • Keep DIRECT_URL   = direct  (:5432)
  • Add the same vars in Vercel → Project → Settings → Environment Variables
  • Smoke test: npm run dev  then  GET /api/health?deep=1
`);
