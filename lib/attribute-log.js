import { prisma } from './db';
import { KML_TYPES } from './kml';

export { KML_TYPES };

export const ATTR_FIELDS = {
  name: 'site_name',
  kmlType: 'kml_type',
  surveyDate: 'survey_date',
  district: 'district',
};

/** Site code for logs and KML filenames: geometry name if set, else id. */
export function siteCodeFor(name, geometryId) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  return trimmed || geometryId;
}

export function dateOnly(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const slice = value.trim().slice(0, 10);
    return slice || null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return null;
}

export function normalizeOptionalString(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

export function normalizeKmlType(value) {
  if (value === undefined) return undefined;
  const normalized = normalizeOptionalString(value);
  if (normalized === null) return null;
  const match = KML_TYPES.find((item) => item.toLowerCase() === normalized.toLowerCase());
  return match || false;
}

export function serializeLogEntry(row) {
  return {
    id: row.id,
    log_id: row.id,
    siteCode: row.siteCode,
    site_code: row.siteCode,
    geometryId: row.geometryId,
    fieldChanged: row.fieldChanged,
    field_changed: row.fieldChanged,
    oldValue: row.oldValue,
    old_value: row.oldValue,
    newValue: row.newValue,
    new_value: row.newValue,
    changedBy: row.changedBy,
    changed_by: row.changedBy,
    changedAt: row.changedAt,
    changed_at: row.changedAt,
  };
}

export async function recordAttributeChange({
  siteCode,
  geometryId,
  fieldChanged,
  oldValue,
  newValue,
  changedBy,
}) {
  const oldText = oldValue == null || oldValue === '' ? null : String(oldValue);
  const newText = newValue == null || newValue === '' ? null : String(newValue);
  if (oldText === newText) return null;

  return prisma.attributeChangeLog.create({
    data: {
      siteCode,
      geometryId,
      fieldChanged,
      oldValue: oldText,
      newValue: newText,
      changedBy,
    },
  });
}

export async function geometryIdsForNodes(nodeIds) {
  if (!Array.isArray(nodeIds) || nodeIds.length === 0) return [];
  const rows = await prisma.uploadGeometry.findMany({
    where: {
      upload: {
        isDeleted: false,
        nodeId: { in: nodeIds },
      },
    },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

export async function recordDistrictChangeForNode({
  nodeId,
  geometryId,
  oldValue,
  newValue,
  changedBy,
}) {
  const oldText = oldValue == null || oldValue === '' ? null : String(oldValue);
  const newText = newValue == null || newValue === '' ? null : String(newValue);
  if (oldText === newText) return 0;

  const geometries = await prisma.uploadGeometry.findMany({
    where: {
      ...(geometryId ? { id: geometryId } : {}),
      upload: {
        isDeleted: false,
        nodeId,
      },
    },
    select: { id: true, name: true },
  });

  if (geometries.length === 0) return 0;

  await prisma.attributeChangeLog.createMany({
    data: geometries.map((geom) => ({
      siteCode: siteCodeFor(geom.name, geom.id),
      geometryId: geom.id,
      fieldChanged: ATTR_FIELDS.district,
      oldValue: oldText,
      newValue: newText,
      changedBy,
    })),
  });
  return geometries.length;
}
