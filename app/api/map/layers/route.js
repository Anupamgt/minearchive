import { prisma } from '../../../../lib/db';
import { getSessionUser, unauthorizedResponse } from '../../../../lib/auth';
import { privateJson } from '../../../../lib/cache-headers';
import { getAccessibleNodeIds } from '../../../../lib/site-access';

/**
 * GeoJSON FeatureCollection of stored KML polygons.
 * GET /api/map/layers
 * GET /api/map/layers?nodeId=<uuid>
 * GET /api/map/layers?uploadIds=id1,id2
 */
export async function GET(request) {
  const session = await getSessionUser(request);
  if (!session) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const nodeId = searchParams.get('nodeId');
    const uploadIdsParam = searchParams.get('uploadIds');
    const uploadIds = uploadIdsParam
      ? uploadIdsParam.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    const accessibleNodeIds = await getAccessibleNodeIds(session);
    if (Array.isArray(accessibleNodeIds) && accessibleNodeIds.length === 0) {
      return privateJson({ type: 'FeatureCollection', features: [] });
    }
    if (nodeId && Array.isArray(accessibleNodeIds) && !accessibleNodeIds.includes(nodeId)) {
      return privateJson({ type: 'FeatureCollection', features: [] });
    }

    const conditions = [`u."isDeleted" = false`, `ug.geom IS NOT NULL`];
    const params = [];

    if (nodeId) {
      params.push(nodeId);
      conditions.push(`u."nodeId" = $${params.length}`);
    } else if (Array.isArray(accessibleNodeIds)) {
      const placeholders = accessibleNodeIds.map((id) => {
        params.push(id);
        return `$${params.length}`;
      });
      conditions.push(`u."nodeId" IN (${placeholders.join(', ')})`);
    }

    if (uploadIds.length > 0) {
      const placeholders = uploadIds.map((id) => {
        params.push(id);
        return `$${params.length}`;
      });
      conditions.push(`u.id IN (${placeholders.join(', ')})`);
    }

    const sql = `
      SELECT
        ug.id AS "geometryId",
        ug."uploadId",
        u."nodeId",
        u.category,
        u."surveyDate",
        u."kmlFilePath",
        u."uploadedBy",
        u."uploadDate",
        n.name AS "nodeName",
        n."locationLabel" AS district,
        ST_AsGeoJSON(ug.geom)::json AS geometry,
        ug.name AS "siteName",
        ug."kmlType",
        ug."sourceProperties",
        ug."partIndex",
        ug."partCount",
        ug."areaHectares",
        ug."perimeterMeters"
      FROM "UploadGeometry" ug
      INNER JOIN "Upload" u ON u.id = ug."uploadId"
      LEFT JOIN "Node" n ON n.id = u."nodeId"
      WHERE ${conditions.join(' AND ')}
      ORDER BY u."uploadDate" DESC, ug.id ASC
    `;

    const rows = await prisma.$queryRawUnsafe(sql, ...params);

    const features = rows.map((row) => ({
      type: 'Feature',
      id: row.geometryId,
      geometry: row.geometry,
      properties: {
        geometryId: row.geometryId,
        uploadId: row.uploadId,
        nodeId: row.nodeId,
        nodeName: row.nodeName,
        category: row.category,
        surveyDate: row.surveyDate,
        district: row.district,
        kmlFilePath: row.kmlFilePath,
        uploadedBy: row.uploadedBy,
        uploadDate: row.uploadDate,
        // Name of the individual site/placemark, distinct from the file it
        // arrived in. Null for rows ingested before names were captured.
        siteName: row.siteName,
        kmlType: row.kmlType,
        sourceProperties: row.sourceProperties,
        partIndex: row.partIndex,
        partCount: row.partCount,
        areaHectares: row.areaHectares,
        perimeterMeters: row.perimeterMeters,
      },
    }));

    return privateJson({
      type: 'FeatureCollection',
      features,
    });
  } catch (error) {
    console.error('GET /api/map/layers error:', error);
    return privateJson({ error: 'Failed to load map layers' }, { status: 500 });
  }
}
