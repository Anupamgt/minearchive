import { DOMParser } from '@xmldom/xmldom';
import { kml } from '@tmcw/togeojson';
import { prisma } from '../../../lib/db';
import { getSessionUser, unauthorizedResponse } from '../../../lib/auth';
import { getCachedUploads, CACHE_TAGS } from '../../../lib/cached-queries';
import { privateJson, bustTags } from '../../../lib/cache-headers';

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

export async function POST(request) {
  const session = await getSessionUser(request);
  if (!session) return unauthorizedResponse();

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const nodeId = formData.get('nodeId');
    const category = formData.get('category');
    const surveyDate = formData.get('surveyDate');
    const notes = formData.get('notes');
    const uploadedBy = session.name;

    if (!file) {
      return privateJson({ error: 'No file provided' }, { status: 400 });
    }

    const text = await file.text();
    const kmlDom = new DOMParser().parseFromString(text);
    const geoJson = kml(kmlDom);

    const upload = await prisma.upload.create({
      data: {
        nodeId: nodeId || null,
        uploadedBy,
        surveyDate: surveyDate ? new Date(surveyDate) : null,
        category: category || 'Routine Survey',
        notes: notes || '',
        kmlFilePath: file.name,
      },
    });

    let parsedFeatures = 0;
    if (geoJson && geoJson.features) {
      for (const feat of geoJson.features) {
        if (feat.geometry && feat.geometry.type === 'Polygon') {
          await prisma.$executeRawUnsafe(
            `INSERT INTO "UploadGeometry" ("id", "uploadId", "areaHectares", "perimeterMeters") VALUES (gen_random_uuid(), $1, 12.5, 340.0)`,
            upload.id
          );
          parsedFeatures++;
        }
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: 'Upload KML',
        targetType: 'Upload',
        targetId: upload.id,
        details: `Uploaded KML ${file.name} (${parsedFeatures} polygons detected)`,
      },
    });

    bustTags(CACHE_TAGS.uploads, CACHE_TAGS.nodes, CACHE_TAGS.audit);

    return privateJson(
      {
        success: true,
        uploadId: upload.id,
        featuresDetected: parsedFeatures,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/uploads error:', error);
    return privateJson({ error: 'Failed to process KML upload' }, { status: 500 });
  }
}
