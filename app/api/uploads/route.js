import { randomUUID } from 'crypto';
import { DOMParser } from '@xmldom/xmldom';
import { kml } from '@tmcw/togeojson';
import { prisma } from '../../../lib/db';
import { getSessionUser, unauthorizedResponse } from '../../../lib/auth';
import { getCachedUploads, CACHE_TAGS } from '../../../lib/cached-queries';
import { privateJson, bustTags } from '../../../lib/cache-headers';
import { polygonsFromGeoJson } from '../../../lib/kml';

export async function GET(request) {
  const session = await getSessionUser(request);
  if (!session) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const nodeId = searchParams.get('nodeId');
    const uploads = await getCachedUploads(nodeId);
    return privateJson(uploads);
  } catch (error) {
    console.error('GET /api/uploads error:', error);
    return privateJson({ error: 'Failed to fetch uploads' }, { status: 500 });
  }
}

async function processOneKmlFile({ file, nodeId, category, surveyDate, notes, uploadedBy, userId }) {
  const text = await file.text();
  const kmlDom = new DOMParser().parseFromString(text, 'text/xml');
  const geoJson = kml(kmlDom);
  const polygons = polygonsFromGeoJson(geoJson);

  if (polygons.length === 0) {
    return {
      success: false,
      fileName: file.name,
      error: 'No Polygon/MultiPolygon features found in KML',
    };
  }

  // Validate node if provided
  let resolvedNodeId = nodeId || null;
  if (resolvedNodeId) {
    const node = await prisma.node.findUnique({ where: { id: resolvedNodeId } });
    if (!node) {
      return {
        success: false,
        fileName: file.name,
        error: `Unknown node id: ${resolvedNodeId}`,
      };
    }
  }

  const upload = await prisma.upload.create({
    data: {
      nodeId: resolvedNodeId,
      uploadedBy,
      surveyDate: surveyDate ? new Date(surveyDate) : null,
      category: category || 'Routine Survey',
      notes: notes || '',
      kmlFilePath: file.name,
    },
  });

  let parsedFeatures = 0;
  for (const poly of polygons) {
    const geomJson = JSON.stringify({
      type: 'Polygon',
      coordinates: poly.coordinates,
    });
    const id = randomUUID();
    // Force 2D — KML coordinates often include altitude (Z) which Polygon,4326 rejects.
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "UploadGeometry" ("id", "uploadId", "geom", "areaHectares", "perimeterMeters")
      VALUES (
        $1,
        $2,
        ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)),
        ST_Area(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326))::geography) / 10000.0,
        ST_Perimeter(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326))::geography)
      )
      `,
      id,
      upload.id,
      geomJson
    );
    parsedFeatures++;
  }

  await prisma.auditLog.create({
    data: {
      userId,
      action: 'Upload KML',
      targetType: 'Upload',
      targetId: upload.id,
      details: `Uploaded KML ${file.name} (${parsedFeatures} polygons detected)`,
    },
  });

  return {
    success: true,
    fileName: file.name,
    uploadId: upload.id,
    nodeId: resolvedNodeId,
    featuresDetected: parsedFeatures,
  };
}

export async function POST(request) {
  const session = await getSessionUser(request);
  if (!session) return unauthorizedResponse();

  try {
    const formData = await request.formData();
    const nodeId = formData.get('nodeId') || null;
    const category = formData.get('category');
    const surveyDate = formData.get('surveyDate');
    const notes = formData.get('notes');
    const uploadedBy = session.name;

    // Support single `file` or multiple `files`
    const files = [];
    const single = formData.get('file');
    if (single && typeof single === 'object' && 'arrayBuffer' in single) {
      files.push(single);
    }
    for (const value of formData.getAll('files')) {
      if (value && typeof value === 'object' && 'arrayBuffer' in value) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return privateJson({ error: 'No KML file provided' }, { status: 400 });
    }

    const results = [];
    for (const file of files) {
      try {
        const result = await processOneKmlFile({
          file,
          nodeId: nodeId ? String(nodeId) : null,
          category: category ? String(category) : null,
          surveyDate: surveyDate ? String(surveyDate) : null,
          notes: notes ? String(notes) : null,
          uploadedBy,
          userId: session.id,
        });
        results.push(result);
      } catch (err) {
        console.error('KML process error:', err);
        results.push({
          success: false,
          fileName: file.name,
          error: err.message || 'Failed to process KML',
        });
      }
    }

    bustTags(CACHE_TAGS.uploads, CACHE_TAGS.nodes, CACHE_TAGS.audit);

    const succeeded = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    return privateJson(
      {
        success: failed.length === 0,
        uploaded: succeeded.length,
        failed: failed.length,
        results,
        // Backward-compatible fields for single-file clients
        uploadId: succeeded[0]?.uploadId,
        featuresDetected: succeeded.reduce((sum, r) => sum + (r.featuresDetected || 0), 0),
      },
      { status: succeeded.length > 0 ? 201 : 400 }
    );
  } catch (error) {
    console.error('POST /api/uploads error:', error);
    return privateJson({ error: 'Failed to process KML upload' }, { status: 500 });
  }
}
