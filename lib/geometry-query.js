import { prisma } from './db';

/**
 * Load stored geometries as GeoJSON features (shared by map layers + KML export).
 */
export async function loadGeometryFeatures({ uploadIds = [], geometryIds = [], nodeId } = {}) {
  const conditions = [`u."isDeleted" = false`, `ug.geom IS NOT NULL`];
  const params = [];

  if (nodeId) {
    params.push(nodeId);
    conditions.push(`u."nodeId" = $${params.length}`);
  }

  if (uploadIds.length > 0) {
    const placeholders = uploadIds.map((id) => {
      params.push(id);
      return `$${params.length}`;
    });
    conditions.push(`u.id IN (${placeholders.join(', ')})`);
  }

  if (geometryIds.length > 0) {
    const placeholders = geometryIds.map((id) => {
      params.push(id);
      return `$${params.length}`;
    });
    conditions.push(`ug.id IN (${placeholders.join(', ')})`);
  }

  const sql = `
    SELECT
      ug.id AS "geometryId",
      ug."uploadId",
      ug.name AS "featureName",
      COALESCE(ug."geomType", REPLACE(ST_GeometryType(ug.geom), 'ST_', '')) AS "geomType",
      u."nodeId",
      u.category,
      u."kmlFilePath",
      u."uploadedBy",
      u."uploadDate",
      u."surveyDate",
      n.name AS "nodeName",
      ST_AsGeoJSON(ug.geom)::json AS geometry,
      ug."areaHectares",
      ug."perimeterMeters"
    FROM "UploadGeometry" ug
    INNER JOIN "Upload" u ON u.id = ug."uploadId"
    LEFT JOIN "Node" n ON n.id = u."nodeId"
    WHERE ${conditions.join(' AND ')}
    ORDER BY u."uploadDate" DESC, ug.id ASC
  `;

  const rows = await prisma.$queryRawUnsafe(sql, ...params);

  return rows.map((row) => ({
    type: 'Feature',
    id: row.geometryId,
    geometry: row.geometry,
    properties: {
      geometryId: row.geometryId,
      uploadId: row.uploadId,
      nodeId: row.nodeId,
      nodeName: row.nodeName,
      name: row.featureName || row.kmlFilePath || 'Untitled',
      geomType: row.geomType,
      category: row.category,
      kmlFilePath: row.kmlFilePath,
      uploadedBy: row.uploadedBy,
      uploadDate: row.uploadDate,
      surveyDate: row.surveyDate,
      areaHectares: row.areaHectares,
      perimeterMeters: row.perimeterMeters,
    },
  }));
}
