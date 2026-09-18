/**
 * Helpers for turning KML into GeoJSON features we can store in PostGIS,
 * rendering them in Leaflet, and exporting them back to KML.
 */

export const KML_TYPES = ['Proposed', 'New', 'Previous'];

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

/**
 * Property keys that commonly hold a site's display name.
 *
 * `@tmcw/togeojson` maps a Placemark's `<name>` to `properties.name`, but it
 * flattens `<ExtendedData>` straight onto properties using the author's own
 * casing — `<SimpleData name="SITE_NAME">` becomes `properties.SITE_NAME`.
 */
const NAME_KEY_CANDIDATES = [
  'sitename',
  'minename',
  'quarryname',
  'leasename',
  'plotname',
  'blockname',
  'name',
  'site',
  'mine',
  'quarry',
  'leaseno',
  'lease',
  'plotno',
  'block',
  'label',
  'title',
];

/** KML leftover keys that duplicate the inspect-card GIS fields. */
const GIS_ATTR_KEYS = new Set([
  'district',
  'locationlabel',
  'location',
  'surveydate',
  'kmltype',
  'sitename',
  'sitecode',
]);

const SUPPORTED_TYPES = new Set([
  'Polygon',
  'MultiPolygon',
  'LineString',
  'MultiLineString',
  'Point',
  'MultiPoint',
  'GeometryCollection',
]);

function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Best-effort display name for a placemark. Returns null when nothing usable is
 * present, so callers can fall back to the file name rather than invent one.
 */
export function siteNameFromProperties(properties) {
  if (typeof properties === 'string') {
    try {
      properties = JSON.parse(properties);
    } catch {
      return null;
    }
  }
  if (!properties || typeof properties !== 'object') return null;

  const byNormalizedKey = new Map();
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    const text = String(value).trim();
    if (!text) continue;
    const normalized = normalizeKey(key);
    if (!byNormalizedKey.has(normalized)) byNormalizedKey.set(normalized, text);
  }

  for (const candidate of NAME_KEY_CANDIDATES) {
    const match = byNormalizedKey.get(candidate);
    if (match) return match;
  }
  return null;
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
      name,
      partIndex: i,
    }));
  }

  if (type === 'MultiLineString') {
    return (coordinates || []).map((coords, i) => ({
      type: 'LineString',
      coordinates: force2DCoords(coords),
      properties,
      name,
      partIndex: i,
    }));
  }

  if (type === 'MultiPoint') {
    return (coordinates || []).map((coords, i) => ({
      type: 'Point',
      coordinates: force2DCoords(coords),
      properties,
      name,
      partIndex: i,
    }));
  }

  if (type === 'GeometryCollection') {
    return (geometries || []).flatMap((g) => explodeGeometry(g, properties, name));
  }

  return [];
}

function withPartCounts(parts) {
  const count = parts.length;
  return parts.map((part, index) => ({
    ...part,
    partIndex: part.partIndex ?? index,
    partCount: count,
  }));
}

/** Extract a GeoJSON Feature into storeable simple geometries. */
export function featuresFromFeature(feature) {
  if (!feature?.geometry) return [];
  if (!SUPPORTED_TYPES.has(feature.geometry.type)) return [];
  const properties = feature.properties || {};
  const name = siteNameFromProperties(properties);
  return withPartCounts(explodeGeometry(feature.geometry, properties, name));
}

/**
 * Extract Polygon geometries from a GeoJSON feature.
 *
 * A single placemark can yield several polygons: MultiPolygon, and KML
 * `<MultiGeometry>` which togeojson emits as a GeometryCollection.
 */
export function polygonsFromFeature(feature) {
  return featuresFromFeature(feature).filter((item) => item.type === 'Polygon');
}

/**
 * Drop a Document/FeatureCollection title that togeojson copied onto every
 * unnamed placemark, so ingest can fall back to the uploaded filename.
 */
function dropCollectionTitle(item, collectionName) {
  if (!collectionName || !item.name || item.name !== collectionName) return item;
  const withoutGenericName = {};
  for (const [key, value] of Object.entries(item.properties || {})) {
    if (normalizeKey(key) === 'name') continue;
    withoutGenericName[key] = value;
  }
  return { ...item, name: siteNameFromProperties(withoutGenericName) };
}

function walkGeoJson(geoJson, mapper) {
  if (!geoJson) return [];
  const collectionName = typeof geoJson.name === 'string' ? geoJson.name.trim() : '';
  const fromFeature = (feature) => mapper(feature).map((item) => dropCollectionTitle(item, collectionName));

  if (geoJson.type === 'FeatureCollection') {
    return (geoJson.features || []).flatMap(fromFeature);
  }
  if (geoJson.type === 'Feature') {
    return fromFeature(geoJson);
  }
  if (SUPPORTED_TYPES.has(geoJson.type)) {
    return fromFeature({ type: 'Feature', geometry: geoJson, properties: {} });
  }
  return [];
}

/** All storeable features from a FeatureCollection / Feature / Geometry. */
export function featuresFromGeoJson(geoJson) {
  return walkGeoJson(geoJson, featuresFromFeature);
}

/** All polygons from a FeatureCollection. */
export function polygonsFromGeoJson(geoJson) {
  return walkGeoJson(geoJson, polygonsFromFeature);
}

/** Filename without path or .kml/.kmz suffix — "Siswan 1.kml" -> "Siswan 1". */
export function fileStem(filePath) {
  if (!filePath || typeof filePath !== 'string') return '';
  const base = filePath.replace(/\\/g, '/').split('/').pop() || '';
  return base.replace(/\.(kml|kmz)$/i, '').trim();
}

/**
 * Site name/code for the map inspect card.
 *
 * Prefers the stored geometry name. On a single-polygon file, a leftover KML
 * Document/placemark title that disagrees with the uploaded filename is ignored
 * so selecting the file shows the filename, not another polygon's name.
 */
export function inspectSiteName({
  siteName,
  kmlFilePath,
  geometryId,
  polygonCount = 1,
  sourceProperties,
} = {}) {
  const stored = typeof siteName === 'string' ? siteName.trim() : '';
  const fromFile = fileStem(kmlFilePath);
  const fromKml = siteNameFromProperties(sourceProperties);
  const fallback = fromFile || geometryId || '';

  if ((polygonCount || 1) <= 1 && fromFile) {
    if (!stored) return fromFile;
    if (
      fromKml &&
      stored === fromKml &&
      stored.toLowerCase() !== fromFile.toLowerCase()
    ) {
      return fromFile;
    }
    return stored;
  }

  return stored || fallback;
}

/**
 * District for the inspect card and KML export: the Node chosen at upload
 * (`Node.name`), never a stale `locationLabel` when the node has a name.
 */
export function inspectDistrict({ nodeName, locationLabel } = {}) {
  const name = typeof nodeName === 'string' ? nodeName.trim() : '';
  if (name) return name;
  const label = typeof locationLabel === 'string' ? locationLabel.trim() : '';
  return label || '';
}

/**
 * Leaflet positions from a GeoJSON geometry.
 * Polygon -> rings of [lat, lng]
 * LineString -> [lat, lng] vertices
 * Point -> [lat, lng]
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
  const out = [];
  for (const ring of pos) {
    for (const ll of ring) out.push(ll);
  }
  return out;
}

/**
 * Label for a feature on the map and in the legend.
 */
export function layerLabel({
  name,
  kmlFilePath,
  partIndex,
  partCount,
  fallbackIndex,
  fallbackCount,
}) {
  if (name) {
    return partCount > 1 ? `${name} (${(partIndex ?? 0) + 1}/${partCount})` : name;
  }

  const base = kmlFilePath || 'Boundary';
  if (fallbackCount > 1) {
    return `${base} (${(fallbackIndex ?? 0) + 1}/${fallbackCount})`;
  }
  return base;
}

/**
 * KML ExtendedData fields that are not the site name itself.
 */
export function extraAttributes(properties) {
  if (typeof properties === 'string') {
    try {
      properties = JSON.parse(properties);
    } catch {
      return [];
    }
  }
  if (!properties || typeof properties !== 'object') return [];

  const usedName = siteNameFromProperties(properties);
  const rows = [];
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      continue;
    }
    const text = String(value).trim();
    if (!text) continue;
    if (usedName && text === usedName) continue;
    if (GIS_ATTR_KEYS.has(normalizeKey(key))) continue;
    rows.push({ key, value: text });
  }
  return rows;
}

export function formatHectares(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value >= 10 ? `${value.toFixed(1)} ha` : `${value.toFixed(2)} ha`;
}

export function formatMeters(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  if (value >= 1000) return `${(value / 1000).toFixed(2)} km`;
  return `${Math.round(value)} m`;
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
  if (type === 'LineString' || type === 'MultiLineString') return 'polyline';
  if (type === 'Point' || type === 'MultiPoint') return 'point';
  return 'polygon';
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function ringToKmlCoordinates(ring) {
  if (!Array.isArray(ring)) return '';
  return ring
    .filter((pair) => Array.isArray(pair) && pair.length >= 2)
    .map(([lng, lat]) => `${lng},${lat},0`)
    .join(' ');
}

function geometryInnerKml(geometry) {
  if (!geometry?.type) return '';
  const coords = geometry.coordinates;
  if (geometry.type === 'Polygon' && Array.isArray(coords)) {
    const outer = coords[0] || [];
    const inners = coords.slice(1);
    const innerXml = inners
      .map(
        (ring) => `
        <innerBoundaryIs>
          <LinearRing>
            <coordinates>${ringToKmlCoordinates(ring)}</coordinates>
          </LinearRing>
        </innerBoundaryIs>`
      )
      .join('');
    return `<Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${ringToKmlCoordinates(outer)}</coordinates>
          </LinearRing>
        </outerBoundaryIs>${innerXml}
      </Polygon>`;
  }
  if (geometry.type === 'LineString' && Array.isArray(coords)) {
    return `<LineString><tessellate>1</tessellate><coordinates>${ringToKmlCoordinates(coords)}</coordinates></LineString>`;
  }
  if (geometry.type === 'Point' && Array.isArray(coords)) {
    const [lng, lat] = coords;
    return `<Point><coordinates>${lng},${lat},0</coordinates></Point>`;
  }
  return '';
}

/**
 * Reconstruct a single-placemark KML from stored GeoJSON + GIS attributes.
 */
export function geometryToKml({ name, district, surveyDate, kmlType, geometry }) {
  const placemarkName = name || 'Unnamed site';
  const geomXml = geometryInnerKml(geometry);
  const data = [
    ['Site Name', name || ''],
    ['District', district || ''],
    ['Survey Date', surveyDate || ''],
    ['KML Type', kmlType || ''],
  ];

  const extended = data
    .map(
      ([key, value]) =>
        `        <Data name="${escapeXml(key)}"><value>${escapeXml(value)}</value></Data>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(placemarkName)}</name>
    <Placemark>
      <name>${escapeXml(placemarkName)}</name>
      <ExtendedData>
${extended}
      </ExtendedData>
      ${geomXml}
    </Placemark>
  </Document>
</kml>
`;
}

/**
 * Build a KML 2.2 document from GeoJSON features (as returned by /api/map/layers).
 */
export function geoJsonFeaturesToKml(features, documentName = 'MineArchive export') {
  const placemarks = (features || [])
    .map((feature, i) => {
      const geomXml = geometryInnerKml(feature.geometry);
      if (!geomXml) return '';
      const name = escapeXml(
        feature.properties?.name ||
          feature.properties?.siteName ||
          feature.properties?.kmlFilePath ||
          `Feature ${i + 1}`
      );
      const district = escapeXml(feature.properties?.district || feature.properties?.nodeName || '');
      const surveyDate = escapeXml(
        feature.properties?.surveyDate
          ? String(feature.properties.surveyDate).slice(0, 10)
          : ''
      );
      const kmlType = escapeXml(feature.properties?.kmlType || '');
      return `  <Placemark>
    <name>${name}</name>
    <ExtendedData>
      <Data name="Site Name"><value>${name}</value></Data>
      <Data name="District"><value>${district}</value></Data>
      <Data name="Survey Date"><value>${surveyDate}</value></Data>
      <Data name="KML Type"><value>${kmlType}</value></Data>
    </ExtendedData>
    ${geomXml}
  </Placemark>`;
    })
    .filter(Boolean)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>${escapeXml(documentName)}</name>
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

/** Safe download filename: {siteCode}.kml, else site-{id}.kml */
export function sanitizeKmlFilename(siteCode, geometryId) {
  const raw = typeof siteCode === 'string' ? siteCode.trim() : '';
  const safe = raw.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return `${safe || `site-${geometryId}`}.kml`;
}
