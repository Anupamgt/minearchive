#!/usr/bin/env node
/**
 * Ensure demo email/password users exist in the database.
 * Usage: node scripts/seed-demo-users.mjs
 */
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

const demos = [
  {
    email: 'admin@minearchive.co',
    name: 'Central Admin',
    role: 'Admin',
    passwordHash: 'admin123',
  },
  {
    email: 'harpreet@mine.co',
    name: 'Harpreet Singh',
    role: 'User',
    passwordHash: 'user123',
  },
];

try {
  for (const demo of demos) {
    const user = await prisma.user.upsert({
      where: { email: demo.email },
      update: {
        name: demo.name,
        role: demo.role,
        status: 'active',
        passwordHash: demo.passwordHash,
      },
      create: {
        ...demo,
        status: 'active',
      },
    });
    console.log(`✔ ${user.email} (${user.role})`);
  }
} finally {
  await prisma.$disconnect();
}
