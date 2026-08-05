import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';
import { logger } from '../../../lib/logger';

/**
 * Production health / diagnostics probe.
 * GET /api/health — always returns process liveness.
 * GET /api/health?deep=1 — also checks DB connectivity (for debugging deploys).
 *
 * Does not expose secrets or stack traces.
 */
export async function GET(request) {
  const deep = request.nextUrl.searchParams.get('deep') === '1';
  const started = Date.now();

  const payload = {
    status: 'ok',
    service: 'minearchive',
    env: process.env.NODE_ENV || 'unknown',
    uptimeSec: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    checks: {
      app: 'ok',
    },
  };

  if (deep) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      payload.checks.database = 'ok';
    } catch (err) {
      payload.status = 'degraded';
      payload.checks.database = 'error';
      logger.error('health deep check failed', {
        reason: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  payload.latencyMs = Date.now() - started;
  const statusCode = payload.status === 'ok' ? 200 : 503;
  return NextResponse.json(payload, { status: statusCode });
}
