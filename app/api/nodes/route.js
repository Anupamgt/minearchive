import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';
import { getSessionUser, unauthorizedResponse, forbiddenResponse } from '../../../lib/auth';

export async function GET(request) {
  const session = await getSessionUser(request);
  if (!session) return unauthorizedResponse();

  try {
    const nodes = await prisma.node.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { uploads: { where: { isDeleted: false } } }
        }
      }
    });

    const formatted = nodes.map(n => ({
      id: n.id,
      name: n.name,
      description: n.description,
      status: n.status,
      locationLabel: n.locationLabel,
      uploadCount: n._count.uploads,
      updatedAt: n.updatedAt,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('GET /api/nodes error:', error);
    return NextResponse.json({ error: 'Failed to fetch nodes' }, { status: 500 });
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
      return NextResponse.json({ error: 'Node name is required' }, { status: 400 });
    }

    const node = await prisma.node.create({
      data: {
        name,
        description,
        status: status || 'proposed',
        locationLabel: locationLabel || 'Ropar District',
        createdBy: session.name,
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: 'Create Node',
        targetType: 'Node',
        targetId: node.id,
        details: `Created node ${node.name}`,
      }
    });

    return NextResponse.json(node, { status: 201 });
  } catch (error) {
    console.error('POST /api/nodes error:', error);
    return NextResponse.json({ error: 'Failed to create node' }, { status: 500 });
  }
}
