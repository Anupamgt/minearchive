import { NextResponse } from 'next/server';
import { getSessionUser, unauthorizedResponse } from '../../../../../lib/auth';
import { loadGeometryFeatures } from '../../../../../lib/geometry-query';
import { geoJsonFeaturesToKml, safeKmlFilename } from '../../../../../lib/kml';

/**
 * Download a single stored feature as its own KML file.
 * GET /api/geometries/:id/kml
 */
export async function GET(request, { params }) {
  const session = await getSessionUser(request);
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  try {
    const features = await loadGeometryFeatures({ geometryIds: [id] });
    if (features.length === 0) {
      return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
    }

    const name = features[0].properties?.name || 'feature';
    const fileName = safeKmlFilename(name);
    const kml = geoJsonFeaturesToKml(features, name);

    return new NextResponse(kml, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.google-earth.kml+xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('GET /api/geometries/[id]/kml error:', error);
    return NextResponse.json({ error: 'Failed to export KML' }, { status: 500 });
  }
}
