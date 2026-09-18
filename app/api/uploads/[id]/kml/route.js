import { NextResponse } from 'next/server';
import { getSessionUser, unauthorizedResponse } from '../../../../../lib/auth';
import { loadGeometryFeatures } from '../../../../../lib/geometry-query';
import { geoJsonFeaturesToKml, safeKmlFilename } from '../../../../../lib/kml';

/**
 * Download every feature in one uploaded KML as a single KML document.
 * GET /api/uploads/:id/kml
 */
export async function GET(request, { params }) {
  const session = await getSessionUser(request);
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  try {
    const features = await loadGeometryFeatures({ uploadIds: [id] });
    if (features.length === 0) {
      return NextResponse.json({ error: 'No features found for this file' }, { status: 404 });
    }

    const fileName = safeKmlFilename(
      features[0].properties?.kmlFilePath,
      `upload-${id}.kml`
    );
    const kml = geoJsonFeaturesToKml(features, fileName.replace(/\.kml$/i, ''));

    return new NextResponse(kml, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.google-earth.kml+xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('GET /api/uploads/[id]/kml error:', error);
    return NextResponse.json({ error: 'Failed to export KML' }, { status: 500 });
  }
}
