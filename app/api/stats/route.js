import { prisma } from '../../../lib/db';
import { getSessionUser, unauthorizedResponse } from '../../../lib/auth';
import { privateJson } from '../../../lib/cache-headers';
import { getAccessibleNodeIds } from '../../../lib/site-access';

/** Dashboard counters. GET /api/stats */
export async function GET(request) {
  const session = await getSessionUser(request);
  if (!session) return unauthorizedResponse();

  try {
    const accessibleNodeIds = await getAccessibleNodeIds(session);
    const scoped = Array.isArray(accessibleNodeIds);
    const nodeWhere = scoped
      ? { id: { in: accessibleNodeIds }, NOT: { status: 'archived' } }
      : { NOT: { status: 'archived' } };
    const uploadWhere = scoped
      ? { isDeleted: false, nodeId: { in: accessibleNodeIds } }
      : { isDeleted: false };
    const pendingWhere = scoped
      ? { status: 'proposed', id: { in: accessibleNodeIds } }
      : { status: 'proposed' };

    const [nodes, uploads, pending, users] = await Promise.all([
      scoped && accessibleNodeIds.length === 0 ? Promise.resolve(0) : prisma.node.count({ where: nodeWhere }),
      scoped && accessibleNodeIds.length === 0 ? Promise.resolve(0) : prisma.upload.count({ where: uploadWhere }),
      scoped && accessibleNodeIds.length === 0 ? Promise.resolve(0) : prisma.node.count({ where: pendingWhere }),
      prisma.user.count({ where: { status: 'active' } }),
    ]);

    return privateJson({ nodes, uploads, pending, users });
  } catch (error) {
    console.error('GET /api/stats error:', error);
    return privateJson({ error: 'Failed to load stats' }, { status: 500 });
  }
}
