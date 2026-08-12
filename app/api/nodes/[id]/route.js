import { prisma } from '../../../../lib/db';
import { getSessionUser, unauthorizedResponse, forbiddenResponse } from '../../../../lib/auth';
import { CACHE_TAGS } from '../../../../lib/cached-queries';
import { privateJson, bustTags } from '../../../../lib/cache-headers';

const ALLOWED_STATUSES = new Set(['active', 'proposed', 'archived']);

export async function PATCH(request, { params }) {
  const session = await getSessionUser(request);
  if (!session) return unauthorizedResponse();
  if (session.role?.toLowerCase() !== 'admin') return forbiddenResponse();

  try {
    const { id } = await params;
    if (!id) {
      return privateJson({ error: 'Node id is required' }, { status: 400 });
    }

    const body = await request.json();
    const status = typeof body.status === 'string' ? body.status.trim().toLowerCase() : null;
    const name = typeof body.name === 'string' ? body.name.trim() : undefined;
    const description =
      typeof body.description === 'string' ? body.description : undefined;
    const locationLabel =
      typeof body.locationLabel === 'string' ? body.locationLabel.trim() : undefined;

    if (status && !ALLOWED_STATUSES.has(status)) {
      return privateJson(
        { error: `Invalid status. Use one of: ${[...ALLOWED_STATUSES].join(', ')}` },
        { status: 400 }
      );
    }

    const existing = await prisma.node.findUnique({ where: { id } });
    if (!existing) {
      return privateJson({ error: 'Monitoring area not found' }, { status: 404 });
    }

    const data = {};
    if (status) data.status = status;
    if (name) data.name = name;
    if (description !== undefined) data.description = description;
    if (locationLabel) data.locationLabel = locationLabel;

    if (Object.keys(data).length === 0) {
      return privateJson({ error: 'No valid fields to update' }, { status: 400 });
    }

    if (status === 'archived') {
      data.approvedBy = session.name;
    }

    const node = await prisma.node.update({
      where: { id },
      data,
    });

    const action =
      status === 'archived'
        ? 'Archive Node'
        : status === 'active' && existing.status === 'archived'
          ? 'Restore Node'
          : status === 'active' && existing.status === 'proposed'
            ? 'Approve Node'
            : 'Update Node';

    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action,
        targetType: 'Node',
        targetId: node.id,
        details:
          status && status !== existing.status
            ? `Changed status of ${node.name} from ${existing.status} to ${status}`
            : `Updated node ${node.name}`,
      },
    });

    bustTags(CACHE_TAGS.nodes, CACHE_TAGS.audit);

    return privateJson({
      id: node.id,
      name: node.name,
      description: node.description,
      status: node.status,
      locationLabel: node.locationLabel,
      updatedAt: node.updatedAt,
    });
  } catch (error) {
    console.error('PATCH /api/nodes/[id] error:', error);
    return privateJson({ error: 'Failed to update monitoring area' }, { status: 500 });
  }
}
