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

export async function getCachedUploads(nodeId) {
  const where = { isDeleted: false };
  if (nodeId) where.nodeId = nodeId;

  const uploads = await prisma.upload.findMany({
    where,
    orderBy: { uploadDate: 'desc' },
    include: {
      node: { select: { name: true, locationLabel: true } },
      _count: { select: { geometries: true } },
    },
  });

  return uploads.map((u) => ({
    id: u.id,
    nodeId: u.nodeId,
    nodeName: u.node?.name || null,
    district: u.node?.name || null,
    locationLabel: u.node?.locationLabel || null,
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
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    lastLogin: u.lastLogin,
    createdAt: u.createdAt,
  }));
}

export async function getCachedAuditLogs(limit = 50) {
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50;

  const logs = await prisma.auditLog.findMany({
    take: safeLimit,
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
