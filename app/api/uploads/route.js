import { randomUUID } from 'crypto';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { kml } from '@tmcw/togeojson';
import { prisma } from '../../../lib/db';
import { getSessionUser, unauthorizedResponse } from '../../../lib/auth';
import { getCachedUploads, CACHE_TAGS } from '../../../lib/cached-queries';
import { privateJson, bustTags } from '../../../lib/cache-headers';
import { featuresFromGeoJson, fileStem, sanitizeKmlXml } from '../../../lib/kml';
import { normalizeKmlType } from '../../../lib/attribute-log';
import { ensureGisSchema } from '../../../lib/gis-schema';

/**
 * Read the KML text out of an uploaded file, transparently handling KMZ.
 * A KMZ is a ZIP archive (magic bytes `PK\x03\x04`) that contains one or more
 * `.kml` documents (conventionally `doc.kml`) plus optional assets.
 */
async function extractKmlText(file) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const isZip =
    buffer.length > 3 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04;
  const looksKmz = /\.kmz$/i.test(file.name || '') || isZip;

  if (!looksKmz) {
    return buffer.toString('utf8');
  }

  const zip = await JSZip.loadAsync(buffer);
  const kmlEntries = Object.keys(zip.files).filter(
    (name) => /\.kml$/i.test(name) && !zip.files[name].dir
  );
  if (kmlEntries.length === 0) {
    throw new Error('KMZ archive contains no .kml document');
  }
  const chosen =
    kmlEntries.find((name) => /(^|\/)doc\.kml$/i.test(name)) || kmlEntries[0];
  return zip.files[chosen].async('string');
}

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

async function processOneKmlFile({
  file,
  nodeId,
  category,
  surveyDate,
  notes,
  kmlType,
  uploadedBy,
  userId,
}) {
  const text = sanitizeKmlXml(await extractKmlText(file));
  const kmlDom = new DOMParser().parseFromString(text, 'text/xml');
  const geoJson = kml(kmlDom);
  const features = featuresFromGeoJson(geoJson);

  if (features.length === 0) {
    return {
      success: false,
      fileName: file.name,
      error: 'No polygon, polyline, or point features found in KML',
    };
  }

  let resolvedNodeId = nodeId || null;
  let nodeName = null;
  if (resolvedNodeId) {
    const node = await prisma.node.findUnique({ where: { id: resolvedNodeId } });
    if (!node) {
      return {
        success: false,
        fileName: file.name,
        error: `Unknown node id: ${resolvedNodeId}`,
      };
    }
    nodeName = node.name;
  }

  const upload = await prisma.upload.create({
    data: {
      nodeId: resolvedNodeId,
      uploadedBy,
      surveyDate: surveyDate ? new Date(surveyDate) : null,
      category: category || null,
      notes: notes || '',
      kmlFilePath: file.name,
    },
  });

  await ensureGisSchema(prisma);

  let parsedFeatures = 0;
  const typeCounts = { Polygon: 0, LineString: 0, Point: 0 };
  for (const feat of features) {
    const geomJson = JSON.stringify({
      type: feat.type,
      coordinates: feat.coordinates,
    });
    const id = randomUUID();
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "UploadGeometry" (
        "id", "uploadId", "geom", "name", "geomType", "sourceProperties",
        "partIndex", "partCount", "areaHectares", "perimeterMeters", "kmlType"
      )
      VALUES (
        $1,
        $2,
        ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)),
        $4,
        $5,
        $6::jsonb,
        $7,
        $8,
        CASE
          WHEN $5 = 'Polygon' THEN ST_Area(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326))::geography) / 10000.0
          ELSE NULL
        END,
        CASE
          WHEN $5 = 'Polygon' THEN ST_Perimeter(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326))::geography)
          WHEN $5 = 'LineString' THEN ST_Length(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326))::geography)
          ELSE NULL
        END,
        $9
      )
      `,
      id,
      upload.id,
      geomJson,
      feat.name || fileStem(file.name) || null,
      feat.type,
      JSON.stringify(feat.properties || {}),
      feat.partIndex ?? 0,
      feat.partCount ?? 1,
      kmlType || null
    );
    parsedFeatures++;
    if (typeCounts[feat.type] !== undefined) typeCounts[feat.type] += 1;
  }

  const summary = [
    typeCounts.Polygon ? `${typeCounts.Polygon} polygon(s)` : null,
    typeCounts.LineString ? `${typeCounts.LineString} polyline(s)` : null,
    typeCounts.Point ? `${typeCounts.Point} point(s)` : null,
  ]
    .filter(Boolean)
    .join(', ');

  const namedFeatures = features.filter((item) => item.name).length;

  await prisma.auditLog.create({
    data: {
      userId,
      action: 'Upload KML',
      targetType: 'Upload',
      targetId: upload.id,
      details: nodeName
        ? `Uploaded KML ${file.name} to ${nodeName} (${summary || `${parsedFeatures} feature(s)`})`
        : `Uploaded KML ${file.name} (${summary || `${parsedFeatures} feature(s)`})`,
    },
  });

  return {
    success: true,
    fileName: file.name,
    uploadId: upload.id,
    nodeId: resolvedNodeId,
    featuresDetected: parsedFeatures,
    typeCounts,
    namedFeatures,
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
    const kmlTypeRaw = formData.get('kmlType');
    const kmlType = normalizeKmlType(kmlTypeRaw === null ? undefined : kmlTypeRaw);
    if (kmlType === false) {
      return privateJson(
        { error: 'kmlType must be Proposed, New, Previous, or blank.' },
        { status: 400 }
      );
    }
    await ensureGisSchema(prisma);

    const uploadedBy = session.name;
    const resolvedNodeId = nodeId ? String(nodeId) : null;
    if (!resolvedNodeId) {
      return privateJson({ error: 'Choose a district.' }, { status: 400 });
    }

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
          nodeId: resolvedNodeId,
          category: category ? String(category) : null,
          surveyDate: surveyDate ? String(surveyDate) : null,
          notes: notes ? String(notes) : null,
          kmlType: kmlType || null,
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
