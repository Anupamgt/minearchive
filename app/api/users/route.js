import { prisma } from '../../../lib/db';
import { getSessionUser, unauthorizedResponse, forbiddenResponse } from '../../../lib/auth';
import { getCachedUsers, CACHE_TAGS } from '../../../lib/cached-queries';
import { privateJson, bustTags } from '../../../lib/cache-headers';

export async function GET(request) {
  const session = await getSessionUser(request);
  if (!session) return unauthorizedResponse();
  if (session.role?.toLowerCase() !== 'admin') return forbiddenResponse();

  try {
    const users = await getCachedUsers();
    return privateJson(users);
  } catch (error) {
    console.error('GET /api/users error:', error);
    return privateJson({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getSessionUser(request);
  if (!session) return unauthorizedResponse();
  if (session.role?.toLowerCase() !== 'admin') return forbiddenResponse();

  try {
    const { name, email, password, role } = await request.json();

    if (!name || !email || !password) {
      return privateJson({ error: 'Missing required fields' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return privateJson({ error: 'Email already exists' }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: password, // MVP demo
        role: role || 'user',
        status: 'active',
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: 'Create User',
        targetType: 'User',
        targetId: user.id,
        details: `Created user ${user.email} (${user.role})`,
      },
    });

    bustTags(CACHE_TAGS.users, CACHE_TAGS.audit);

    return privateJson(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/users error:', error);
    return privateJson({ error: 'Failed to create user' }, { status: 500 });
  }
}
