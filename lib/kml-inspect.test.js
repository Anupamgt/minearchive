import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extraAttributes,
  fileStem,
  inspectDistrict,
  inspectSiteName,
  kmlAttachmentDisposition,
  polygonsFromGeoJson,
  safeKmlFilename,
  sanitizeKmlFilename,
  siteNameFromProperties,
} from './kml.js';

test('fileStem strips path and kml suffix', () => {
  assert.equal(fileStem('Siswan 1.kml'), 'Siswan 1');
  assert.equal(fileStem('folder/Siswan 1.KMZ'), 'Siswan 1');
  assert.equal(fileStem(''), '');
});

test('inspectDistrict uses Node.name, not locationLabel or KML leftovers', () => {
  assert.equal(
    inspectDistrict({ nodeName: 'SAS Nagar', locationLabel: 'Ropar District' }),
    'SAS Nagar'
  );
  assert.equal(inspectDistrict({ nodeName: '', locationLabel: 'Ropar District' }), 'Ropar District');
  assert.equal(inspectDistrict({ nodeName: '  SAS Nagar  ' }), 'SAS Nagar');
  assert.equal(inspectDistrict({}), '');
});

test('inspectSiteName uses filename when a single polygon only has a leftover KML title', () => {
  assert.equal(
    inspectSiteName({
      siteName: 'Ropar North Quarry Sector 1 Active Pit',
      kmlFilePath: 'Siswan 1.kml',
      geometryId: 'geom-1',
      polygonCount: 1,
      sourceProperties: { name: 'Ropar North Quarry Sector 1 Active Pit' },
    }),
    'Siswan 1'
  );
});

test('inspectSiteName keeps an admin-edited name on a single-polygon file', () => {
  assert.equal(
    inspectSiteName({
      siteName: 'Siswan 1 Pit A',
      kmlFilePath: 'Siswan 1.kml',
      polygonCount: 1,
      sourceProperties: { name: 'Ropar North Quarry Sector 1 Active Pit' },
    }),
    'Siswan 1 Pit A'
  );
});

test('inspectSiteName falls back to filename when stored name is empty', () => {
  assert.equal(
    inspectSiteName({
      siteName: '',
      kmlFilePath: 'Siswan 1.kml',
      geometryId: 'geom-1',
      polygonCount: 1,
    }),
    'Siswan 1'
  );
});

test('inspectSiteName keeps placemark names in multi-polygon files', () => {
  assert.equal(
    inspectSiteName({
      siteName: 'Block A',
      kmlFilePath: 'district-survey.kml',
      polygonCount: 4,
      sourceProperties: { name: 'Block A' },
    }),
    'Block A'
  );
});

test('siteNameFromProperties prefers SITE_NAME over a Document name', () => {
  assert.equal(
    siteNameFromProperties({
      name: 'IRODA PROVIDED_DATA_KEY-MINING SITES',
      SITE_NAME: 'Siswan 1',
    }),
    'Siswan 1'
  );
});

test('polygonsFromGeoJson drops a FeatureCollection title copied onto placemarks', () => {
  const polygons = polygonsFromGeoJson({
    type: 'FeatureCollection',
    name: 'Ropar North Quarry Monitoring Survey',
    features: [
      {
        type: 'Feature',
        properties: { name: 'Ropar North Quarry Monitoring Survey' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [76.52, 30.98],
              [76.54, 30.99],
              [76.53, 30.97],
              [76.52, 30.98],
            ],
          ],
        },
      },
    ],
  });
  assert.equal(polygons[0].name, null);
});

test('extraAttributes hides leftover District fields that disagree with the node', () => {
  const rows = extraAttributes({
    name: 'Siswan 1',
    District: 'Some Other Tehsil',
    LEASE_NO: 'PB/SAS/1',
  });
  assert.deepEqual(
    rows.map((row) => row.key),
    ['LEASE_NO']
  );
});

test('safeKmlFilename strips CR/LF and falls back to ASCII uuid name', () => {
  const fallback = 'upload-abc123.kml';
  const injected = safeKmlFilename('lease\r\nHidden.kml', fallback);
  assert.equal(injected, fallback);
  assert.equal(injected.includes('\r'), false);
  assert.equal(injected.includes('\n'), false);
  assert.equal(safeKmlFilename('site\0x.kml', fallback), fallback);
  assert.equal(safeKmlFilename('foo"bar.kml', fallback), fallback);
  assert.equal(safeKmlFilename('foo\\bar.kml', fallback), fallback);
});

test('safeKmlFilename keeps a simple ASCII name for ZIP entries', () => {
  assert.equal(safeKmlFilename('Siswan 1.kml', 'upload-x.kml'), 'Siswan-1.kml');
});

test('sanitizeKmlFilename uses feature-{id}.kml when the site code is unsafe', () => {
  assert.equal(sanitizeKmlFilename('Siswan-1', 'geom-9'), 'Siswan-1.kml');
  assert.equal(sanitizeKmlFilename('bad\rname', 'geom-9'), 'feature-geom-9.kml');
  assert.match(
    kmlAttachmentDisposition('bad\rname.kml', 'feature-geom-9.kml'),
    /^attachment; filename="feature-geom-9\.kml"$/
  );
});
