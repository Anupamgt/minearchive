import { prisma } from '../../../../lib/db';
import { getSessionUser, unauthorizedResponse, forbiddenResponse } from '../../../../lib/auth';
import { CACHE_TAGS } from '../../../../lib/cached-queries';
import { privateJson, bustTags } from '../../../../lib/cache-headers';
import {
  ATTR_FIELDS,
  dateOnly,
  normalizeKmlType,
  normalizeOptionalString,
  siteCodeFor,
} from '../../../../lib/attribute-log';

/**
 * PATCH /api/geometries/[id]
 * Admin-only attribute edits: name, kmlType, surveyDate (parent Upload).
 * Each changed field writes AttributeChangeLog.
 */
export async function PATCH(request, { params }) {
  const session = await getSessionUser(request);
  if (!session) return unauthorizedResponse();
  if (session.role?.toLowerCase() !== 'admin') return forbiddenResponse();

  try {
    const { id } = await params;
    if (!id) {
      return privateJson({ error: 'Geometry id is required' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const nextName = normalizeOptionalString(body.name);
    const nextKmlType = normalizeKmlType(body.kmlType);
    const nextSurveyDate = body.surveyDate === undefined
      ? undefined
      : dateOnly(body.surveyDate);

    if (nextKmlType === false) {
      return privateJson(
        { error: 'kmlType must be Proposed, New, Previous, or blank.' },
        { status: 400 }
      );
    }

    const geometry = await prisma.uploadGeometry.findUnique({
      where: { id },
      include: {
        upload: {
          select: {
            id: true,
            isDeleted: true,
            surveyDate: true,
            nodeId: true,
          },
        },
      },
    });

    if (!geometry || geometry.upload?.isDeleted) {
      return privateJson({ error: 'Site not found' }, { status: 404 });
    }

    const changedBy = session.name || session.email || session.id;
    const geometryData = {};
    const uploadData = {};
    const logs = [];

    if (nextName !== undefined && nextName !== (geometry.name || null)) {
      geometryData.name = nextName;
      logs.push({
        fieldChanged: ATTR_FIELDS.name,
        oldValue: geometry.name,
        newValue: nextName,
        siteCode: siteCodeFor(nextName, geometry.id),
      });
    }

    if (nextKmlType !== undefined && nextKmlType !== (geometry.kmlType || null)) {
      geometryData.kmlType = nextKmlType;
      logs.push({
        fieldChanged: ATTR_FIELDS.kmlType,
        oldValue: geometry.kmlType,
        newValue: nextKmlType,
        siteCode: siteCodeFor(nextName !== undefined ? nextName : geometry.name, geometry.id),
      });
    }

    const currentSurvey = dateOnly(geometry.upload?.surveyDate);
    if (nextSurveyDate !== undefined && nextSurveyDate !== currentSurvey) {
      uploadData.surveyDate = nextSurveyDate ? new Date(`${nextSurveyDate}T00:00:00.000Z`) : null;
      logs.push({
        fieldChanged: ATTR_FIELDS.surveyDate,
        oldValue: currentSurvey,
        newValue: nextSurveyDate,
        siteCode: siteCodeFor(nextName !== undefined ? nextName : geometry.name, geometry.id),
      });
    }

    if (Object.keys(geometryData).length === 0 && Object.keys(uploadData).length === 0) {
      return privateJson({ error: 'No valid fields to update' }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = Object.keys(geometryData).length
        ? await tx.uploadGeometry.update({
            where: { id },
            data: geometryData,
          })
        : geometry;

      let surveyDate = geometry.upload?.surveyDate || null;
      if (Object.keys(uploadData).length) {
        const upload = await tx.upload.update({
          where: { id: geometry.upload.id },
          data: uploadData,
        });
        surveyDate = upload.surveyDate;
      }

      for (const log of logs) {
        const oldText = log.oldValue == null || log.oldValue === '' ? null : String(log.oldValue);
        const newText = log.newValue == null || log.newValue === '' ? null : String(log.newValue);
        if (oldText === newText) continue;
        await tx.attributeChangeLog.create({
          data: {
            siteCode: log.siteCode,
            geometryId: id,
            fieldChanged: log.fieldChanged,
            oldValue: oldText,
            newValue: newText,
            changedBy,
          },
        });
      }

      return { row, surveyDate };
    });

    bustTags(CACHE_TAGS.uploads, CACHE_TAGS.nodes);

    return privateJson({
      id: updated.row.id,
      name: updated.row.name,
      kmlType: updated.row.kmlType,
      surveyDate: updated.surveyDate,
      siteCode: siteCodeFor(updated.row.name, updated.row.id),
    });
  } catch (error) {
    console.error('PATCH /api/geometries/[id] error:', error);
    return privateJson({ error: 'Failed to update site attributes' }, { status: 500 });
  }
}
