import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/db';
import { getSessionUser, unauthorizedResponse } from '../../../../../lib/auth';
import { loadGeometryFeatures } from '../../../../../lib/geometry-query';
import { fileStem, geoJsonFeaturesToKml, kmlAttachmentDisposition, safeKmlFilename } from '../../../../../lib/kml';
import { ensureGisSchema } from '../../../../../lib/gis-schema';

/**
 * Download every feature in one uploaded KML as a single KML document.
 * GET /api/uploads/:id/kml
 */
export async function GET(request, { params }) {
  const session = await getSessionUser(request);
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  try {
    await ensureGisSchema(prisma);
    const features = await loadGeometryFeatures({ uploadIds: [id] });
    if (features.length === 0) {
      return NextResponse.json({ error: 'No features found for this file' }, { status: 404 });
    }

    const originalPath = features[0].properties?.kmlFilePath;
    const fileName = safeKmlFilename(originalPath, `upload-${id}.kml`);
    const kml = geoJsonFeaturesToKml(
      features,
      fileStem(originalPath) || 'MineArchive export'
    );

    return new NextResponse(kml, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.google-earth.kml+xml; charset=utf-8',
        'Content-Disposition': kmlAttachmentDisposition(fileName, `upload-${id}.kml`),
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('GET /api/uploads/[id]/kml error:', error);
    return NextResponse.json({ error: 'Failed to export KML' }, { status: 500 });
  }
}
