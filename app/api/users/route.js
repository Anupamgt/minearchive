import { prisma } from '../../../lib/db';
import { getSessionUser, unauthorizedResponse, forbiddenResponse } from '../../../lib/auth';
import { getCachedUsers, CACHE_TAGS } from '../../../lib/cached-queries';
import { privateJson, bustTags } from '../../../lib/cache-headers';
import {
  assignedSitesInclude,
  normalizeNodeIds,
  serializeUser,
  validateNodeIds,
} from '../../../lib/site-access';

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
    const { name, email, password, role, assignedNodeIds: rawAssigned } = await request.json();

    if (!name || !email || !password) {
      return privateJson({ error: 'Missing required fields' }, { status: 400 });
    }

    const assignedNodeIds = normalizeNodeIds(rawAssigned === undefined ? [] : rawAssigned);
    if (assignedNodeIds === null) {
      return privateJson({ error: 'assignedNodeIds must be an array of site ids' }, { status: 400 });
    }

    const valid = await validateNodeIds(assignedNodeIds);
    if (!valid.ok) {
      return privateJson({ error: valid.error }, { status: 400 });
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
        assignedSites:
          assignedNodeIds.length > 0
            ? { create: assignedNodeIds.map((nodeId) => ({ nodeId })) }
            : undefined,
      },
      include: assignedSitesInclude,
    });

    const siteNames = serializeUser(user).assignedSites.map((s) => s.name);
    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: 'Create User',
        targetType: 'User',
        targetId: user.id,
        details: `Created user ${user.email} (${user.role})${
          siteNames.length ? `; assigned sites: ${siteNames.join(', ')}` : ''
        }`,
      },
    });

    bustTags(CACHE_TAGS.users, CACHE_TAGS.audit);

    return privateJson(serializeUser(user), { status: 201 });
  } catch (error) {
    console.error('POST /api/users error:', error);
    return privateJson({ error: 'Failed to create user' }, { status: 500 });
  }
}
