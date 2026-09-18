import { prisma } from '../../../lib/db';
import { getSessionUser, unauthorizedResponse } from '../../../lib/auth';
import { privateJson } from '../../../lib/cache-headers';

/** Dashboard counters. GET /api/stats */
export async function GET(request) {
  const session = await getSessionUser(request);
  if (!session) return unauthorizedResponse();

  try {
    const [nodes, uploads, pending, users] = await Promise.all([
      prisma.node.count({ where: { NOT: { status: 'archived' } } }),
      prisma.upload.count({ where: { isDeleted: false } }),
      prisma.node.count({ where: { status: 'proposed' } }),
      prisma.user.count({ where: { status: 'active' } }),
    ]);

    return privateJson({ nodes, uploads, pending, users });
  } catch (error) {
    console.error('GET /api/stats error:', error);
    return privateJson({ error: 'Failed to load stats' }, { status: 500 });
  }
}
