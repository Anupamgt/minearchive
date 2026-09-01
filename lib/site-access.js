import { prisma } from './db';

export function isAdmin(session) {
  return (session?.role || '').toLowerCase() === 'admin';
}

export const assignedSitesInclude = {
  assignedSites: {
    include: {
      node: { select: { id: true, name: true } },
    },
  },
};

/**
 * Node ids a field user may see. Empty array means assigned to nothing
 * (do not fall back to all sites).
 */
export async function getAssignedNodeIds(userId) {
  if (!userId) return [];
  const rows = await prisma.userSiteAssignment.findMany({
    where: { userId },
    select: { nodeId: true },
  });
  return rows.map((row) => row.nodeId);
}

/**
 * Accessible node ids for the current session.
 * `null` means admin (no restriction). `[]` means a field user with no sites.
 */
export async function getAccessibleNodeIds(session) {
  if (!session) return [];
  if (isAdmin(session)) return null;
  return getAssignedNodeIds(session.id);
}

export function canAccessNodeId(accessibleNodeIds, nodeId) {
  if (accessibleNodeIds === null) return true;
  if (!nodeId) return false;
  return accessibleNodeIds.includes(nodeId);
}

export function serializeAssignedSites(assignments) {
  return (assignments || [])
    .map((row) => ({
      id: row.node?.id || row.nodeId,
      name: row.node?.name || row.nodeId,
    }))
    .filter((site) => site.id)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export function serializeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
    assignedSites: serializeAssignedSites(user.assignedSites),
  };
}

/** `undefined` = field omitted; `null` = invalid payload; otherwise unique ids. */
export function normalizeNodeIds(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return null;
  return [...new Set(value.map((id) => String(id ?? '').trim()).filter(Boolean))];
}

export async function validateNodeIds(nodeIds) {
  if (!nodeIds || nodeIds.length === 0) return { ok: true, ids: [] };
  const found = await prisma.node.findMany({
    where: { id: { in: nodeIds } },
    select: { id: true },
  });
  if (found.length !== nodeIds.length) {
    return { ok: false, error: 'One or more assigned sites were not found.' };
  }
  return { ok: true, ids: nodeIds };
}

export async function replaceUserAssignments(tx, userId, nodeIds) {
  const client = tx || prisma;
  await client.userSiteAssignment.deleteMany({ where: { userId } });
  if (nodeIds.length === 0) return;
  await client.userSiteAssignment.createMany({
    data: nodeIds.map((nodeId) => ({ userId, nodeId })),
  });
}
