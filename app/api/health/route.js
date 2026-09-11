import { prisma } from '../../../lib/db';
import { noStoreJson } from '../../../lib/cache-headers';
import { ensureGisSchema } from '../../../lib/gis-schema';

/**
 * Liveness / DB probe for Supabase + local deploys.
 * GET /api/health
 * GET /api/health?deep=1  — also checks Postgres connectivity (+ PostGIS when available)
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
    checks: { app: 'ok' },
  };

  if (deep) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      payload.checks.database = 'ok';
      try {
        const rows = await prisma.$queryRawUnsafe('SELECT PostGIS_Version() AS version');
        payload.checks.postgis = rows?.[0]?.version ? 'ok' : 'missing';
        if (rows?.[0]?.version) payload.postgisVersion = String(rows[0].version);
      } catch {
        payload.checks.postgis = 'missing';
      }
      try {
        await ensureGisSchema(prisma);
        const cols = await prisma.$queryRawUnsafe(`
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'UploadGeometry'
            AND column_name = 'kmlType'
        `);
        payload.checks.gisSchema = cols?.length ? 'ok' : 'missing';
        if (!cols?.length) payload.status = 'degraded';
      } catch {
        payload.status = 'degraded';
        payload.checks.gisSchema = 'error';
      }
    } catch {
      payload.status = 'degraded';
      payload.checks.database = 'error';
    }
  }

  payload.latencyMs = Date.now() - started;
  return noStoreJson(payload, { status: payload.status === 'ok' ? 200 : 503 });
}
