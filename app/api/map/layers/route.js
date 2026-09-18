import { getSessionUser, unauthorizedResponse } from '../../../../lib/auth';
import { privateJson } from '../../../../lib/cache-headers';
import { loadGeometryFeatures } from '../../../../lib/geometry-query';

/**
 * GeoJSON FeatureCollection of stored KML features (polygons, polylines, points).
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

    const features = await loadGeometryFeatures({
      nodeId: nodeId || undefined,
      uploadIds,
    });

    return privateJson({
      type: 'FeatureCollection',
      features,
    });
  } catch (error) {
    console.error('GET /api/map/layers error:', error);
    return privateJson({ error: 'Failed to load map layers' }, { status: 500 });
  }
}
