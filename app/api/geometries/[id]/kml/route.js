import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/db';
import { getSessionUser, unauthorizedResponse } from '../../../../../lib/auth';
import { ensureGisSchema } from '../../../../../lib/gis-schema';
import { dateOnly, siteCodeFor } from '../../../../../lib/attribute-log';
import {
  fileStem,
  geometryToKml,
  inspectDistrict,
  inspectSiteName,
  sanitizeKmlFilename,
} from '../../../../../lib/kml';

/**
 * GET /api/geometries/[id]/kml
 * Reconstruct current polygon + Site Name, District, Survey Date, KML Type.
 */
export async function GET(request, { params }) {
  const session = await getSessionUser(request);
  if (!session) return unauthorizedResponse();

  try {
    await ensureGisSchema(prisma);
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Geometry id is required' }, { status: 400 });
    }

    const rows = await prisma.$queryRawUnsafe(
      `
      SELECT
        ug.id,
        ug.name,
        ug."kmlType",
        ug."sourceProperties",
        u."surveyDate",
        u."kmlFilePath",
        u."nodeId",
        n.name AS "nodeName",
        n."locationLabel" AS "locationLabel",
        (
          SELECT COUNT(*)::int FROM "UploadGeometry" sib
          WHERE sib."uploadId" = ug."uploadId"
        ) AS "polygonCount",
        ST_AsGeoJSON(ug.geom)::json AS geometry
      FROM "UploadGeometry" ug
      INNER JOIN "Upload" u ON u.id = ug."uploadId"
      LEFT JOIN "Node" n ON n.id = u."nodeId"
      WHERE ug.id = $1 AND u."isDeleted" = false AND ug.geom IS NOT NULL
      `,
      id
    );

    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const district = inspectDistrict({
      nodeName: row.nodeName,
      locationLabel: row.locationLabel,
    });
    const name =
      inspectSiteName({
        siteName: row.name,
        kmlFilePath: row.kmlFilePath,
        geometryId: row.id,
        polygonCount: row.polygonCount || 1,
        sourceProperties: row.sourceProperties,
      }) || fileStem(row.kmlFilePath);
    const siteCode = siteCodeFor(name, row.id);
    const filename = sanitizeKmlFilename(siteCode, row.id);
    const xml = geometryToKml({
      name,
      district,
      surveyDate: dateOnly(row.surveyDate),
      kmlType: row.kmlType,
      geometry: row.geometry,
    });

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.google-earth.kml+xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('GET /api/geometries/[id]/kml error:', error);
    return NextResponse.json({ error: 'Failed to export KML' }, { status: 500 });
  }
}
