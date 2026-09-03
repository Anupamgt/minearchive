import { prisma } from '../../../../lib/db';
import { getSessionUser, unauthorizedResponse } from '../../../../lib/auth';
import { privateJson } from '../../../../lib/cache-headers';
import { getAccessibleNodeIds } from '../../../../lib/site-access';
import { geometryIdsForNodes, serializeLogEntry } from '../../../../lib/attribute-log';

/**
 * GET /api/map/activity-log?site=&geometryId=&limit=
 * Maps GIS attribute change log. Newest first. Not /audit.
 */
export async function GET(request) {
  const session = await getSessionUser(request);
  if (!session) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const site = (searchParams.get('site') || '').trim();
    const geometryId = (searchParams.get('geometryId') || '').trim();
    const rawLimit = Number(searchParams.get('limit'));
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 80;

    const accessibleNodeIds = await getAccessibleNodeIds(session);
    if (Array.isArray(accessibleNodeIds) && accessibleNodeIds.length === 0) {
      return privateJson([]);
    }

    const where = {};
    if (site) {
      where.siteCode = { contains: site, mode: 'insensitive' };
    }
    if (geometryId) {
      where.geometryId = geometryId;
    }

    if (Array.isArray(accessibleNodeIds)) {
      const allowedIds = await geometryIdsForNodes(accessibleNodeIds);
      if (allowedIds.length === 0) return privateJson([]);
      where.geometryId = geometryId
        ? (allowedIds.includes(geometryId) ? geometryId : '__none__')
        : { in: allowedIds };
    }

    const rows = await prisma.attributeChangeLog.findMany({
      where,
      orderBy: { changedAt: 'desc' },
      take: limit,
    });

    return privateJson(rows.map(serializeLogEntry));
  } catch (error) {
    console.error('GET /api/map/activity-log error:', error);
    return privateJson({ error: 'Failed to load activity log' }, { status: 500 });
  }
}
