import { PrismaClient } from '@prisma/client';

const globalForPrisma = global;

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.MINEARCHIVE_DEBUG === 'true' ? ['query', 'error', 'warn'] : ['error'],
  });
}

// Reuse the client across hot reloads in dev; create fresh in serverless.
export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
