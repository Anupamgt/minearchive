#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
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

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('Set DIRECT_URL or DATABASE_URL');
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });

const NODES = [
  {
    name: 'Ropar North Quarry',
    description: 'Primary enclosure along Sutlej river basin',
    status: 'active',
    locationLabel: 'Ropar District',
  },
  {
    name: 'Sutlej River Pit',
    description: 'Riverbank extraction site',
    status: 'active',
    locationLabel: 'Ropar District',
  },
  {
    name: 'Nangal Road Site',
    description: 'Roadside monitoring node',
    status: 'active',
    locationLabel: 'Ropar District',
  },
  {
    name: 'Kiratpur Quarry',
    description: 'Northern upland quarry',
    status: 'active',
    locationLabel: 'Ropar District',
  },
];

try {
  for (const node of NODES) {
    const existing = await prisma.node.findUnique({ where: { name: node.name } });
    if (existing) {
      console.log(`· exists ${existing.name} (${existing.id})`);
      continue;
    }
    const created = await prisma.node.create({
      data: { ...node, createdBy: 'seed' },
    });
    console.log(`✔ created ${created.name} (${created.id})`);
  }
} finally {
  await prisma.$disconnect();
}
