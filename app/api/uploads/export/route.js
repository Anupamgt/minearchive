import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import { prisma } from '../../../../lib/db';
import { getSessionUser, unauthorizedResponse } from '../../../../lib/auth';
import { countGeometryFeatures, loadGeometryFeatures } from '../../../../lib/geometry-query';
import { fileStem, geoJsonFeaturesToKml, kmlAttachmentDisposition, safeKmlFilename } from '../../../../lib/kml';
import { KML_EXPORT_LIMITS } from '../../../../lib/kml-ingest';
import { ensureGisSchema } from '../../../../lib/gis-schema';

/**
 * Export ticked uploads as one combined KML, or as a ZIP of per-file KMLs.
 * POST /api/uploads/export
 * body: { uploadIds: string[], mode: 'combined' | 'separate' }
 */
export async function POST(request) {
  const session = await getSessionUser(request);
  if (!session) return unauthorizedResponse();

  try {
    const body = await request.json().catch(() => ({}));
    const uploadIds = Array.isArray(body.uploadIds)
      ? body.uploadIds.map(String).filter(Boolean)
      : [];
    const mode = body.mode === 'separate' ? 'separate' : 'combined';

    if (uploadIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one file' }, { status: 400 });
    }
    if (uploadIds.length > KML_EXPORT_LIMITS.MAX_UPLOAD_IDS) {
      return NextResponse.json(
        {
          error: `Export is limited to ${KML_EXPORT_LIMITS.MAX_UPLOAD_IDS} files at a time.`,
        },
        { status: 400 }
      );
    }

    await ensureGisSchema(prisma);
    const featureCount = await countGeometryFeatures({ uploadIds });
    if (featureCount === 0) {
      return NextResponse.json({ error: 'No features found for the selected files' }, { status: 404 });
    }
    if (featureCount > KML_EXPORT_LIMITS.MAX_FEATURES) {
      return NextResponse.json(
        {
          error: `Export exceeds the ${KML_EXPORT_LIMITS.MAX_FEATURES} feature limit. Select fewer files.`,
        },
        { status: 400 }
      );
    }

    const features = await loadGeometryFeatures({ uploadIds });
    if (features.length === 0) {
      return NextResponse.json({ error: 'No features found for the selected files' }, { status: 404 });
    }

    if (mode === 'combined') {
      const kml = geoJsonFeaturesToKml(features, 'MineArchive combined export');
      if (Buffer.byteLength(kml, 'utf8') > KML_EXPORT_LIMITS.MAX_KML_BYTES) {
        return NextResponse.json(
          {
            error: `Combined KML exceeds the ${Math.round(KML_EXPORT_LIMITS.MAX_KML_BYTES / (1024 * 1024))} MB size limit. Export fewer files or use separate files.`,
          },
          { status: 400 }
        );
      }
      return new NextResponse(kml, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.google-earth.kml+xml; charset=utf-8',
          'Content-Disposition': kmlAttachmentDisposition('combined-export.kml'),
          'Cache-Control': 'private, no-store',
        },
      });
    }

    const byUpload = new Map();
    for (const feature of features) {
      const uid = feature.properties?.uploadId;
      if (!uid) continue;
      if (!byUpload.has(uid)) byUpload.set(uid, []);
      byUpload.get(uid).push(feature);
    }

    const zip = new JSZip();
    const usedNames = new Set();
    let totalKmlBytes = 0;
    for (const [uploadId, group] of byUpload.entries()) {
      const originalPath = group[0].properties?.kmlFilePath;
      let fileName = safeKmlFilename(originalPath, `upload-${uploadId}.kml`);
      if (usedNames.has(fileName.toLowerCase())) {
        const stem = fileName.replace(/\.kml$/i, '');
        let n = 2;
        while (usedNames.has(`${stem}-${n}.kml`.toLowerCase())) n += 1;
        fileName = `${stem}-${n}.kml`;
      }
      usedNames.add(fileName.toLowerCase());
      const displayName = fileStem(originalPath) || fileName.replace(/\.kml$/i, '');
      const kml = geoJsonFeaturesToKml(group, displayName);
      totalKmlBytes += Buffer.byteLength(kml, 'utf8');
      if (totalKmlBytes > KML_EXPORT_LIMITS.MAX_KML_BYTES) {
        return NextResponse.json(
          {
            error: `Export exceeds the ${Math.round(KML_EXPORT_LIMITS.MAX_KML_BYTES / (1024 * 1024))} MB KML size limit. Select fewer files.`,
          },
          { status: 400 }
        );
      }
      zip.file(fileName, kml);
    }

    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="selected-kml-files.zip"',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('POST /api/uploads/export error:', error);
    return NextResponse.json({ error: 'Failed to export KML' }, { status: 500 });
  }
}
