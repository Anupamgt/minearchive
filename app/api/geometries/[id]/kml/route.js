import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/db';
import { getSessionUser, unauthorizedResponse } from '../../../../../lib/auth';
import { canAccessNodeId, getAccessibleNodeIds } from '../../../../../lib/site-access';
import { dateOnly, siteCodeFor } from '../../../../../lib/attribute-log';
import { geometryToKml, sanitizeKmlFilename } from '../../../../../lib/kml';

/**
 * GET /api/geometries/[id]/kml
 * Reconstruct current polygon + Site Name, District, Survey Date, KML Type.
 */
export async function GET(request, { params }) {
  const session = await getSessionUser(request);
  if (!session) return unauthorizedResponse();

  try {
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
        u."surveyDate",
        u."nodeId",
        n."locationLabel" AS district,
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

    const accessibleNodeIds = await getAccessibleNodeIds(session);
    if (!canAccessNodeId(accessibleNodeIds, row.nodeId)) {
      return NextResponse.json({ error: 'You do not have access to this site.' }, { status: 403 });
    }

    const siteCode = siteCodeFor(row.name, row.id);
    const filename = sanitizeKmlFilename(siteCode, row.id);
    const xml = geometryToKml({
      name: row.name,
      district: row.district,
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
