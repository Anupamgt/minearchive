import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import { getSessionUser, unauthorizedResponse } from '../../../../lib/auth';
import { loadGeometryFeatures } from '../../../../lib/geometry-query';
import { geoJsonFeaturesToKml, safeKmlFilename } from '../../../../lib/kml';

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

    const features = await loadGeometryFeatures({ uploadIds });
    if (features.length === 0) {
      return NextResponse.json({ error: 'No features found for the selected files' }, { status: 404 });
    }

    if (mode === 'combined') {
      const kml = geoJsonFeaturesToKml(features, 'MineArchive combined export');
      return new NextResponse(kml, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.google-earth.kml+xml; charset=utf-8',
          'Content-Disposition': 'attachment; filename="combined-export.kml"',
          'Cache-Control': 'private, no-store',
        },
      });
    }

    const byUpload = new Map();
    for (const feature of features) {
      const uid = feature.properties?.uploadId;
      if (!byUpload.has(uid)) byUpload.set(uid, []);
      byUpload.get(uid).push(feature);
    }

    const zip = new JSZip();
    const usedNames = new Set();
    for (const group of byUpload.values()) {
      let fileName = safeKmlFilename(group[0].properties?.kmlFilePath, 'layer.kml');
      if (usedNames.has(fileName.toLowerCase())) {
        const stem = fileName.replace(/\.kml$/i, '');
        let n = 2;
        while (usedNames.has(`${stem}-${n}.kml`.toLowerCase())) n += 1;
        fileName = `${stem}-${n}.kml`;
      }
      usedNames.add(fileName.toLowerCase());
      zip.file(fileName, geoJsonFeaturesToKml(group, fileName.replace(/\.kml$/i, '')));
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
