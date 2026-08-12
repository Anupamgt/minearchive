import { prisma } from '../../../../lib/db';
import { getSessionUser, unauthorizedResponse, forbiddenResponse } from '../../../../lib/auth';
import { privateJson } from '../../../../lib/cache-headers';

const ALLOWED_STATUSES = new Set(['active', 'disabled']);
const ALLOWED_ROLES = new Set(['admin', 'user']);

function normalizeRole(role) {
  const r = String(role || '').trim().toLowerCase();
  if (!ALLOWED_ROLES.has(r)) return null;
  return r === 'admin' ? 'Admin' : 'User';
}

export async function PATCH(request, { params }) {
  const session = await getSessionUser(request);
  if (!session) return unauthorizedResponse();
  if (session.role?.toLowerCase() !== 'admin') return forbiddenResponse();

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return privateJson({ error: 'User not found' }, { status: 404 });
    }

    const data = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return privateJson({ error: 'Name cannot be empty' }, { status: 400 });
      data.name = name;
    }

    if (body.role !== undefined) {
      const role = normalizeRole(body.role);
      if (!role) return privateJson({ error: 'Role must be Admin or User' }, { status: 400 });
      data.role = role;
    }

    if (body.status !== undefined) {
      const status = String(body.status).trim().toLowerCase();
      if (!ALLOWED_STATUSES.has(status)) {
        return privateJson({ error: 'Status must be active or disabled' }, { status: 400 });
      }
      data.status = status;
    }

    if (Object.keys(data).length === 0) {
      return privateJson({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Never let an admin lock themselves out or remove the last active admin.
    // Only relevant when this user is currently an *active* admin and the change
    // would take that away (disabling them, or demoting them to User).
    const wasActiveAdmin =
      existing.role?.toLowerCase() === 'admin' && existing.status === 'active';
    const willBeAdmin = (data.role ?? existing.role)?.toLowerCase() === 'admin';
    const willBeActive = (data.status ?? existing.status) === 'active';
    const losingAdminAccess = wasActiveAdmin && !(willBeAdmin && willBeActive);

    if (losingAdminAccess) {
      if (existing.id === session.id) {
        return privateJson(
          { error: 'You cannot disable or demote your own admin account.' },
          { status: 400 }
        );
      }
      const otherActiveAdmins = await prisma.user.count({
        where: {
          id: { not: existing.id },
          role: { equals: 'Admin', mode: 'insensitive' },
          status: 'active',
        },
      });
      if (otherActiveAdmins === 0) {
        return privateJson(
          { error: 'At least one active admin must remain.' },
          { status: 400 }
        );
      }
    }

    const user = await prisma.user.update({ where: { id }, data });

    const changes = [];
    if (data.name && data.name !== existing.name) changes.push(`name → ${data.name}`);
    if (data.role && data.role !== existing.role) changes.push(`role → ${data.role}`);
    if (data.status && data.status !== existing.status) changes.push(`status → ${data.status}`);

    const action =
      data.status === 'disabled'
        ? 'Disable User'
        : data.status === 'active' && existing.status === 'disabled'
          ? 'Enable User'
          : 'Update User';

    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action,
        targetType: 'User',
        targetId: user.id,
        details: `${user.email}: ${changes.join(', ') || 'no change'}`,
      },
    });

    return privateJson({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      lastLogin: user.lastLogin,
    });
  } catch (error) {
    console.error('PATCH /api/users/[id] error:', error);
    return privateJson({ error: 'Failed to update user' }, { status: 500 });
  }
}
