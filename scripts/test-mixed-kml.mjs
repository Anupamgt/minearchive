#!/usr/bin/env node
/**
 * Unit-test mixed-geometry parsing (Polygon / LineString / Point).
 * Uses sample KMLs from Downloads when present; always runs synthetic GeoJSON cases.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMParser } from '@xmldom/xmldom';
import { kml } from '@tmcw/togeojson';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const kmlSource = readFileSync(join(root, 'lib', 'kml.js'), 'utf8');
const { featuresFromGeoJson, sanitizeKmlXml } = await import(
  `data:text/javascript;charset=utf-8,${encodeURIComponent(kmlSource)}`
);

function parseKmlFile(filePath) {
  const text = sanitizeKmlXml(readFileSync(filePath, 'utf8'));
  const geoJson = kml(new DOMParser().parseFromString(text, 'text/xml'));
  return featuresFromGeoJson(geoJson);
}

function countTypes(features) {
  const counts = { Polygon: 0, LineString: 0, Point: 0 };
  for (const feature of features) {
    if (counts[feature.type] !== undefined) counts[feature.type] += 1;
  }
  return counts;
}

const mixed = featuresFromGeoJson({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Lease' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [76.5, 30.9],
            [76.6, 30.9],
            [76.6, 31.0],
            [76.5, 30.9],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Haul road' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [76.5, 30.9],
          [76.55, 30.95],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Survey mark' },
      geometry: { type: 'Point', coordinates: [76.52, 30.91] },
    },
    {
      type: 'Feature',
      properties: { name: 'Cluster' },
      geometry: {
        type: 'GeometryCollection',
        geometries: [
          { type: 'Point', coordinates: [76.51, 30.9] },
          {
            type: 'Polygon',
            coordinates: [
              [
                [76.4, 30.8],
                [76.41, 30.8],
                [76.41, 30.81],
                [76.4, 30.8],
              ],
            ],
          },
        ],
      },
    },
  ],
});

const synthetic = countTypes(mixed);
assert.equal(synthetic.Polygon, 2, 'synthetic polygons');
assert.equal(synthetic.LineString, 1, 'synthetic polylines');
assert.equal(synthetic.Point, 2, 'synthetic points');
console.log('✔ synthetic mixed GeoJSON', synthetic);

const sukhera = 'C:\\Users\\sharm\\Downloads\\12_Sukhera Bodla.kml';
if (existsSync(sukhera)) {
  const features = parseKmlFile(sukhera);
  const counts = countTypes(features);
  assert.ok(features.length >= 3, `Sukhera Bodla should have features, got ${features.length}`);
  assert.equal(counts.LineString, features.length, 'Sukhera Bodla is LineString-only');
  assert.equal(counts.Polygon, 0);
  assert.equal(counts.Point, 0);
  console.log('✔ 12_Sukhera Bodla.kml', counts);
} else {
  console.log('⚠ sample missing:', sukhera);
}

const sas = 'C:\\Users\\sharm\\Downloads\\SASswn.kml';
if (existsSync(sas)) {
  const features = parseKmlFile(sas);
  const counts = countTypes(features);
  assert.ok(counts.Polygon > 0, 'SASswn should include polygons');
  assert.ok(counts.Point > 0, 'SASswn should include points');
  assert.ok(features.length >= 2, `SASswn should have mixed features, got ${features.length}`);
  console.log('✔ SASswn.kml', counts);
} else {
  console.log('⚠ sample missing:', sas);
}

console.log('All mixed-geometry parse checks passed.');
