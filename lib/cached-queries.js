import { unstable_cache } from 'next/cache';
import { prisma } from './db';

/** Cache tags used with revalidateTag(..., 'max') after mutations. */
export const CACHE_TAGS = {
  nodes: 'nodes',
  uploads: 'uploads',
  users: 'users',
  audit: 'audit',
};

/** Default TTL (seconds) for authenticated list endpoints. */
const LIST_REVALIDATE_SECONDS = 240;

export function getCachedNodes() {
  return unstable_cache(
    async () => {
      const nodes = await prisma.node.findMany({
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
    },
    ['nodes-list'],
    { tags: [CACHE_TAGS.nodes], revalidate: LIST_REVALIDATE_SECONDS }
  )();
}

export function getCachedUploads(nodeId) {
  const key = nodeId ? `uploads-node-${nodeId}` : 'uploads-all';
  return unstable_cache(
    async () => {
      const where = { isDeleted: false };
      if (nodeId) where.nodeId = nodeId;

      return prisma.upload.findMany({
        where,
        orderBy: { uploadDate: 'desc' },
        include: {
          node: { select: { name: true } },
        },
      });
    },
    [key],
    { tags: [CACHE_TAGS.uploads], revalidate: LIST_REVALIDATE_SECONDS }
  )();
}

export function getCachedUsers() {
  return unstable_cache(
    async () => {
      return prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          lastLogin: true,
          createdAt: true,
        },
      });
    },
    ['users-list'],
    { tags: [CACHE_TAGS.users], revalidate: LIST_REVALIDATE_SECONDS }
  )();
}

export function getCachedAuditLogs(limit = 50) {
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50;
  return unstable_cache(
    async () => {
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
    },
    [`audit-list-${safeLimit}`],
    { tags: [CACHE_TAGS.audit], revalidate: LIST_REVALIDATE_SECONDS }
  )();
}
