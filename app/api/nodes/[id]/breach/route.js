import { prisma } from '../../../../../lib/db';
import { getSessionUser, unauthorizedResponse, forbiddenResponse } from '../../../../../lib/auth';
import { privateJson } from '../../../../../lib/cache-headers';

/**
 * Record a formal encroachment breach notice against a district.
 * POST /api/nodes/[id]/breach  { reason }
 */
export async function POST(request, { params }) {
  const session = await getSessionUser(request);
  if (!session) return unauthorizedResponse();
  if (session.role?.toLowerCase() !== 'admin') return forbiddenResponse();

  try {
    const { id } = await params;
    const body = await request.json();
    const reason = String(body.reason || '').trim();

    if (!reason) {
      return privateJson({ error: 'Findings / evidence is required' }, { status: 400 });
    }

    const node = await prisma.node.findUnique({ where: { id } });
    if (!node) {
      return privateJson({ error: 'District not found' }, { status: 404 });
    }

    const entry = await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: 'Encroachment Breach',
        targetType: 'Node',
        targetId: node.id,
        details: `${node.name}: ${reason}`,
      },
    });

    return privateJson(
      {
        success: true,
        auditLogId: entry.id,
        nodeId: node.id,
        nodeName: node.name,
        recordedAt: entry.timestamp,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/nodes/[id]/breach error:', error);
    return privateJson({ error: 'Failed to record breach notice' }, { status: 500 });
  }
}
