import { prisma } from '../../../lib/db';
import { getSessionUser, unauthorizedResponse, forbiddenResponse } from '../../../lib/auth';
import { getCachedNodes, CACHE_TAGS } from '../../../lib/cached-queries';
import { privateJson, bustTags } from '../../../lib/cache-headers';

export async function GET(request) {
  const session = await getSessionUser(request);
  if (!session) return unauthorizedResponse();

  try {
    const nodes = await getCachedNodes();
    return privateJson(nodes);
  } catch (error) {
    console.error('GET /api/nodes error:', error);
    return privateJson({ error: 'Failed to fetch nodes' }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getSessionUser(request);
  if (!session) return unauthorizedResponse();
  if (session.role?.toLowerCase() !== 'admin') return forbiddenResponse();

  try {
    const body = await request.json();
    const { name, description, status, locationLabel } = body;

    if (!name) {
      return privateJson({ error: 'Node name is required' }, { status: 400 });
    }

    const node = await prisma.node.create({
      data: {
        name,
        description,
        status: status || 'proposed',
        locationLabel: locationLabel || 'Ropar District',
        createdBy: session.name,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: 'Create Node',
        targetType: 'Node',
        targetId: node.id,
        details: `Created node ${node.name}`,
      },
    });

    bustTags(CACHE_TAGS.nodes, CACHE_TAGS.audit);

    return privateJson(node, { status: 201 });
  } catch (error) {
    console.error('POST /api/nodes error:', error);
    return privateJson({ error: 'Failed to create node' }, { status: 500 });
  }
}
