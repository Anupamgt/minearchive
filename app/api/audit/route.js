import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    
    const logs = await prisma.auditLog.findMany({
      take: limit,
      orderBy: { timestamp: 'desc' },
      include: {
        user: { select: { name: true, email: true } }
      }
    });

    const formatted = logs.map(l => ({
      id: l.id,
      timestamp: l.timestamp,
      userName: l.user ? l.user.name : (l.userId || 'System'),
      action: l.action,
      targetType: l.targetType,
      targetId: l.targetId,
      details: l.details,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('GET /api/audit error:', error);
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}
