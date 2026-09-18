/**
 * Helpers for turning KML → GeoJSON features we can store in PostGIS,
 * rendering them in Leaflet, and exporting them back to KML.
 */

/**
 * Google Earth sometimes writes `xsi:schemaLocation` on nested <Document>
 * nodes without declaring xmlns:xsi. @xmldom/xmldom rejects that; browsers don't.
 */
export function sanitizeKmlXml(xml) {
  if (typeof xml !== 'string' || !xml) return xml;
  let text = xml;
  const declaresXsi = /\sxmlns:xsi\s*=/.test(text);
  const usesXsi = /\sxsi:[A-Za-z]/.test(text);
  if (usesXsi && !declaresXsi) {
    const injected = text.replace(
      /<kml\b([^>]*?)>/i,
      (full, attrs) => `<kml${attrs} xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">`
    );
    text =
      injected === text
        ? text.replace(/\s+xsi:[A-Za-z0-9_:-]+="[^"]*"/g, '')
        : injected;
  }
  return text;
}

/** Drop altitude (Z) from coordinate arrays — PostGIS Geometry,4326 is stored 2D. */
export function force2DCoords(coords) {
  if (!Array.isArray(coords)) return coords;
  if (typeof coords[0] === 'number') return coords.slice(0, 2);
  return coords.map(force2DCoords);
}

const SUPPORTED_TYPES = new Set([
  'Polygon',
  'MultiPolygon',
  'LineString',
  'MultiLineString',
  'Point',
  'MultiPoint',
  'GeometryCollection',
]);

function featureName(feature, fallback = 'Untitled') {
  const props = feature?.properties || {};
  const name = props.name || props.Name || props.siteName;
  return String(name || fallback).trim() || fallback;
}

function explodeGeometry(geometry, properties, name) {
  if (!geometry?.type) return [];
  const { type, coordinates, geometries } = geometry;

  if (type === 'Polygon' || type === 'LineString' || type === 'Point') {
    return [
      {
        type,
        coordinates: force2DCoords(coordinates),
        properties,
        name,
      },
    ];
  }

  if (type === 'MultiPolygon') {
    return (coordinates || []).map((coords, i) => ({
      type: 'Polygon',
      coordinates: force2DCoords(coords),
      properties,
      name: (coordinates || []).length > 1 ? `${name} (${i + 1})` : name,
    }));
  }

  if (type === 'MultiLineString') {
    return (coordinates || []).map((coords, i) => ({
      type: 'LineString',
      coordinates: force2DCoords(coords),
      properties,
      name: (coordinates || []).length > 1 ? `${name} (${i + 1})` : name,
    }));
  }

  if (type === 'MultiPoint') {
    return (coordinates || []).map((coords, i) => ({
      type: 'Point',
      coordinates: force2DCoords(coords),
      properties,
      name: (coordinates || []).length > 1 ? `${name} (${i + 1})` : name,
    }));
  }

  if (type === 'GeometryCollection') {
    return (geometries || []).flatMap((g) => explodeGeometry(g, properties, name));
  }

  return [];
}

/** Extract a single GeoJSON Feature into storeable simple geometries. */
export function featuresFromFeature(feature) {
  if (!feature?.geometry) return [];
  if (!SUPPORTED_TYPES.has(feature.geometry.type)) return [];
  return explodeGeometry(feature.geometry, feature.properties || {}, featureName(feature));
}

/** All storeable features from a FeatureCollection / Feature / Geometry. */
export function featuresFromGeoJson(geoJson) {
  if (!geoJson) return [];
  if (geoJson.type === 'FeatureCollection') {
    return (geoJson.features || []).flatMap(featuresFromFeature);
  }
  if (geoJson.type === 'Feature') {
    return featuresFromFeature(geoJson);
  }
  if (SUPPORTED_TYPES.has(geoJson.type)) {
    return featuresFromFeature({ type: 'Feature', geometry: geoJson, properties: {} });
  }
  return [];
}

/** @deprecated Use featuresFromGeoJson — kept so existing imports keep working. */
export function polygonsFromFeature(feature) {
  return featuresFromFeature(feature).filter((f) => f.type === 'Polygon');
}

/** @deprecated Use featuresFromGeoJson */
export function polygonsFromGeoJson(geoJson) {
  return featuresFromGeoJson(geoJson).filter((f) => f.type === 'Polygon');
}

/**
 * Leaflet positions from a GeoJSON geometry.
 * Polygon → number[][][] (rings of [lat, lng])
 * LineString → number[][] ([lat, lng] vertices)
 * Point → [lat, lng]
 */
export function geoJsonToLeafletPositions(geometry) {
  if (!geometry?.type) return null;
  const coords = geometry.coordinates;
  if (!coords) return null;

  if (geometry.type === 'Polygon') {
    return (coords || []).map((ring) => ring.map(([lng, lat]) => [lat, lng]));
  }
  if (geometry.type === 'LineString') {
    return (coords || []).map(([lng, lat]) => [lat, lng]);
  }
  if (geometry.type === 'Point') {
    const [lng, lat] = coords;
    return [lat, lng];
  }
  if (geometry.type === 'MultiPolygon') {
    return (coords[0] || []).map((ring) => ring.map(([lng, lat]) => [lat, lng]));
  }
  if (geometry.type === 'MultiLineString') {
    return (coords[0] || []).map(([lng, lat]) => [lat, lng]);
  }
  if (geometry.type === 'MultiPoint') {
    const [lng, lat] = coords[0] || [];
    return [lat, lng];
  }
  return null;
}

/** Leaflet [lat, lng] rings from GeoJSON Polygon coordinates [lng, lat]. */
export function geoJsonPolygonToLatLngs(geometry) {
  const positions = geoJsonToLeafletPositions(geometry);
  if (!positions) return [];
  if (geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon') return positions;
  return [];
}

/** Flatten any stored geometry into [lat, lng] points (for fitBounds). */
export function leafletLatLngsFromLayer(layer) {
  if (!layer) return [];
  const type = layer.geomType || 'Polygon';
  const pos = layer.positions;
  if (!pos) return [];
  if (type === 'Point') return [pos];
  if (type === 'LineString') return pos;
  // Polygon rings
  const out = [];
  for (const ring of pos) {
    for (const ll of ring) out.push(ll);
  }
  return out;
}

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function coordPair(lng, lat) {
  return `${lng},${lat},0`;
}

function geometryToKml(geometry) {
  if (!geometry?.type) return '';
  const coords = geometry.coordinates;
  if (geometry.type === 'Polygon') {
    const outer = (coords[0] || []).map(([lng, lat]) => coordPair(lng, lat)).join(' ');
    const inners = (coords.slice(1) || [])
      .map(
        (ring) =>
          `<innerBoundaryIs><LinearRing><coordinates>${ring
            .map(([lng, lat]) => coordPair(lng, lat))
            .join(' ')}</coordinates></LinearRing></innerBoundaryIs>`
      )
      .join('');
    return `<Polygon><outerBoundaryIs><LinearRing><coordinates>${outer}</coordinates></LinearRing></outerBoundaryIs>${inners}</Polygon>`;
  }
  if (geometry.type === 'LineString') {
    const line = (coords || []).map(([lng, lat]) => coordPair(lng, lat)).join(' ');
    return `<LineString><tessellate>1</tessellate><coordinates>${line}</coordinates></LineString>`;
  }
  if (geometry.type === 'Point') {
    const [lng, lat] = coords;
    return `<Point><coordinates>${coordPair(lng, lat)}</coordinates></Point>`;
  }
  return '';
}

/**
 * Build a KML 2.2 document from GeoJSON features (as returned by /api/map/layers).
 */
export function geoJsonFeaturesToKml(features, documentName = 'MineArchive export') {
  const placemarks = (features || [])
    .map((feature, i) => {
      const geomXml = geometryToKml(feature.geometry);
      if (!geomXml) return '';
      const name = xmlEscape(feature.properties?.name || feature.properties?.kmlFilePath || `Feature ${i + 1}`);
      return `  <Placemark>\n    <name>${name}</name>\n    ${geomXml}\n  </Placemark>`;
    })
    .filter(Boolean)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>${xmlEscape(documentName)}</name>
${placemarks}
</Document>
</kml>
`;
}

export function safeKmlFilename(name, fallback = 'export.kml') {
  const base = String(name || fallback)
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  if (!base) return fallback;
  return /\.kml$/i.test(base) ? base : `${base}.kml`;
}

/** Distinct colors for stacking multiple KML overlays. */
export const LAYER_COLORS = [
  '#007acc',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#a855f7',
  '#06b6d4',
  '#e11d48',
  '#84cc16',
];

export function colorForIndex(index) {
  return LAYER_COLORS[index % LAYER_COLORS.length];
}

export function describeGeomType(type) {
  if (type === 'LineString') return 'polyline';
  if (type === 'Point') return 'point';
  return 'polygon';
}
