#!/usr/bin/env node
/**
 * Apply prisma/sql/01_lock_postgis_catalog.sql against the direct DB URL.
 *
 * Usage: npm run db:lock-postgis
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const sqlPath = resolve(root, 'prisma/sql/01_lock_postgis_catalog.sql');

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

/**
 * Prisma cannot send a whole SQL file as one query. Split into the DO block
 * and the PostgREST schema reload.
 */
export async function lockPostgisCatalog(prisma) {
  const text = readFileSync(sqlPath, 'utf8');
  const doBlock = text.match(/DO \$\$[\s\S]*END \$\$;/);
  if (!doBlock) {
    throw new Error(`Could not find DO $$ block in ${sqlPath}`);
  }
  await prisma.$executeRawUnsafe(doBlock[0]);
  try {
    await prisma.$executeRawUnsafe(`NOTIFY pgrst, 'reload schema'`);
  } catch {
    // Local Docker has no PostgREST listener — ignore.
  }
}

loadEnvFile(resolve(root, '.env.local'));
loadEnvFile(resolve(root, '.env'));

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!directUrl) {
    console.error(
      'DIRECT_URL / DATABASE_URL is not set.\n' +
        '  Put the Supabase connection string in .env.local, or paste\n' +
        '  prisma/sql/01_lock_postgis_catalog.sql into the Supabase SQL Editor.'
    );
    process.exit(1);
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: directUrl } },
  });

  try {
    console.log('→ Locking PostGIS catalog (spatial_ref_sys) from the Data API…');
    await lockPostgisCatalog(prisma);
    console.log('✔ PostGIS catalog lock attempted (see notices).');
    console.log('  On hosted Supabase, ENABLE RLS is skipped — that warning is a false positive.');
  } catch (err) {
    console.error(`✖ ${err.message}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}
