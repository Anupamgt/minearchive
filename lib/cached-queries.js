import { prisma } from './db';

/**
 * Authenticated list queries for the admin UI.
 *
 * These endpoints are per-session, mutated frequently from the UI (create node,
 * create user, upload KML), and served with `Cache-Control: private, no-store`
 * (see lib/cache-headers.js + vercel.json), so they are never cached at the CDN.
 *
 * They previously wrapped Prisma in `unstable_cache(..., { revalidate: 240 })`
 * and relied on `revalidateTag(tag, 'max')` after mutations. In Next.js 16 that
 * tag revalidation is stale-while-revalidate: the first read after a write still
 * returns stale data, so newly created nodes/users/uploads (and audit entries)
 * did not appear until a later refresh. `updateTag` (read-your-own-writes) is
 * only callable from Server Actions, not Route Handlers, and the immediate
 * single-arg `revalidateTag(tag)` form is deprecated.
 *
 * For a low-traffic admin CRUD tool, read-after-write correctness matters more
 * than a server-side data cache, so these now query the database directly.
 */

/**
 * Retained for import compatibility with the route handlers. No longer used to
 * tag a data cache (see bustTags in lib/cache-headers.js).
 */
export const CACHE_TAGS = {
  nodes: 'nodes',
  uploads: 'uploads',
  users: 'users',
  audit: 'audit',
};

export async function getCachedNodes({ nodeIds } = {}) {
  if (Array.isArray(nodeIds) && nodeIds.length === 0) return [];

  const nodes = await prisma.node.findMany({
    where: Array.isArray(nodeIds) ? { id: { in: nodeIds } } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { uploads: { where: { isDeleted: false } } },
      },
    },
  });

  return nodes.map((n) => ({
    id: n.id,
    name: n.name,
    description: n.description,
    status: n.status,
    locationLabel: n.locationLabel,
    uploadCount: n._count.uploads,
    updatedAt: n.updatedAt,
  }));
}

export async function getCachedUploads(nodeId, { allowedNodeIds } = {}) {
  if (Array.isArray(allowedNodeIds) && allowedNodeIds.length === 0) return [];
  if (nodeId && Array.isArray(allowedNodeIds) && !allowedNodeIds.includes(nodeId)) {
    return [];
  }

  const where = { isDeleted: false };
  if (nodeId) where.nodeId = nodeId;
  else if (Array.isArray(allowedNodeIds)) where.nodeId = { in: allowedNodeIds };

  const uploads = await prisma.upload.findMany({
    where,
    orderBy: { uploadDate: 'desc' },
    include: {
      node: { select: { name: true } },
      _count: { select: { geometries: true } },
    },
  });

  return uploads.map((u) => ({
    id: u.id,
    nodeId: u.nodeId,
    nodeName: u.node?.name || null,
    uploadedBy: u.uploadedBy,
    uploadDate: u.uploadDate,
    surveyDate: u.surveyDate,
    category: u.category,
    notes: u.notes,
    kmlFilePath: u.kmlFilePath,
    geometryCount: u._count.geometries,
  }));
}

export async function getCachedUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      assignedSites: {
        include: {
          node: { select: { id: true, name: true } },
        },
      },
    },
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    lastLogin: u.lastLogin,
    createdAt: u.createdAt,
    assignedSites: (u.assignedSites || [])
      .map((row) => ({ id: row.node?.id, name: row.node?.name }))
      .filter((site) => site.id)
      .sort((a, b) => String(a.name).localeCompare(String(b.name))),
  }));
}

/**
 * @param {number} limit
 * @param {{ nodeIds?: string[] }} [opts]  When `nodeIds` is an array, only
 *   site-scoped actions (uploads / node changes / breaches) for those nodes
 *   are returned. An empty array yields no rows (unassigned field user).
 */
export async function getCachedAuditLogs(limit = 50, { nodeIds } = {}) {
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50;

  if (Array.isArray(nodeIds) && nodeIds.length === 0) return [];

  let where;
  if (Array.isArray(nodeIds)) {
    const uploads = await prisma.upload.findMany({
      where: { nodeId: { in: nodeIds } },
      select: { id: true },
    });
    const uploadIds = uploads.map((u) => u.id);
    const or = [{ targetType: 'Node', targetId: { in: nodeIds } }];
    if (uploadIds.length > 0) {
      or.push({ targetType: 'Upload', targetId: { in: uploadIds } });
    }
    where = { OR: or };
  }

  const logs = await prisma.auditLog.findMany({
    take: safeLimit,
    ...(where ? { where } : {}),
    orderBy: { timestamp: 'desc' },
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  return logs.map((l) => ({
    id: l.id,
    timestamp: l.timestamp,
    userName: l.user ? l.user.name : l.userId || 'System',
    action: l.action,
    targetType: l.targetType,
    targetId: l.targetId,
    details: l.details,
  }));
}
