import { prisma } from '../../../../lib/db';
import { getSessionUser, unauthorizedResponse, forbiddenResponse } from '../../../../lib/auth';
import { privateJson } from '../../../../lib/cache-headers';

/** Soft-delete a boundary upload. DELETE /api/uploads/[id] */
export async function DELETE(request, { params }) {
  const session = await getSessionUser(request);
  if (!session) return unauthorizedResponse();
  if (session.role?.toLowerCase() !== 'admin') return forbiddenResponse();

  try {
    const { id } = await params;

    const upload = await prisma.upload.findUnique({ where: { id } });
    if (!upload || upload.isDeleted) {
      return privateJson({ error: 'Boundary file not found' }, { status: 404 });
    }

    await prisma.upload.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedBy: session.name,
        deletedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: 'Delete Upload',
        targetType: 'Upload',
        targetId: id,
        details: `Removed boundary file ${upload.kmlFilePath || id}`,
      },
    });

    return privateJson({ success: true, id });
  } catch (error) {
    console.error('DELETE /api/uploads/[id] error:', error);
    return privateJson({ error: 'Failed to delete boundary file' }, { status: 500 });
  }
}
