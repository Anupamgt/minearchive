/**
 * Helpers for turning KML → GeoJSON polygons we can store in PostGIS.
 */

/** Drop altitude (Z) from coordinate arrays — PostGIS Polygon,4326 is 2D. */
function force2DCoords(coords) {
  if (!Array.isArray(coords)) return coords;
  if (typeof coords[0] === 'number') return coords.slice(0, 2);
  return coords.map(force2DCoords);
}

/**
 * Property keys that commonly hold a site's display name.
 *
 * `@tmcw/togeojson` maps a Placemark's `<name>` to `properties.name`, but it
 * flattens `<ExtendedData>` straight onto properties using the author's own
 * casing — `<SimpleData name="SITE_NAME">` becomes `properties.SITE_NAME`, and
 * `<Data name="Name">` becomes `properties.Name`. Survey exports frequently
 * leave `<name>` empty and put the real identifier in ExtendedData, so we probe
 * a list of candidates rather than trusting `name` alone.
 *
 * Compared after stripping non-alphanumerics and lowercasing, most specific
 * first.
 */
const NAME_KEY_CANDIDATES = [
  'name',
  'sitename',
  'site',
  'minename',
  'mine',
  'quarryname',
  'quarry',
  'leasename',
  'leaseno',
  'lease',
  'plotname',
  'plotno',
  'blockname',
  'block',
  'label',
  'title',
];

function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Best-effort display name for a placemark. Returns null when nothing usable is
 * present, so callers can fall back to the file name rather than invent one.
 */
export function siteNameFromProperties(properties) {
  if (!properties || typeof properties !== 'object') return null;

  const byNormalizedKey = new Map();
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    const text = String(value).trim();
    if (!text) continue;
    const normalized = normalizeKey(key);
    // First writer wins, so an exact `name` beats a later `Name` duplicate.
    if (!byNormalizedKey.has(normalized)) byNormalizedKey.set(normalized, text);
  }

  for (const candidate of NAME_KEY_CANDIDATES) {
    const found = byNormalizedKey.get(candidate);
    if (found) return found;
  }
  return null;
}

/**
 * Extract Polygon geometries from a GeoJSON feature.
 *
 * A single placemark can yield several polygons: MultiPolygon, and KML
 * `<MultiGeometry>` which togeojson emits as a GeometryCollection. Each polygon
 * carries its placemark's name and raw properties so callers can label it.
 */
export function polygonsFromFeature(feature) {
  if (!feature?.geometry) return [];

  const properties = feature.properties || {};
  const name = siteNameFromProperties(properties);

  const collect = (geometry) => {
    if (!geometry) return [];
    if (geometry.type === 'Polygon') {
      return [force2DCoords(geometry.coordinates)];
    }
    if (geometry.type === 'MultiPolygon') {
      return (geometry.coordinates || []).map(force2DCoords);
    }
    if (geometry.type === 'GeometryCollection') {
      return (geometry.geometries || []).flatMap(collect);
    }
    return [];
  };

  const rings = collect(feature.geometry);

  return rings.map((coordinates, index) => ({
    type: 'Polygon',
    coordinates,
    name,
    properties,
    // Lets the UI disambiguate "Site A (1/3)" when one placemark splits.
    partIndex: index,
    partCount: rings.length,
  }));
}

/** All polygons from a FeatureCollection. */
export function polygonsFromGeoJson(geoJson) {
  if (!geoJson) return [];
  if (geoJson.type === 'FeatureCollection') {
    return (geoJson.features || []).flatMap(polygonsFromFeature);
  }
  if (geoJson.type === 'Feature') {
    return polygonsFromFeature(geoJson);
  }
  if (
    geoJson.type === 'Polygon' ||
    geoJson.type === 'MultiPolygon' ||
    geoJson.type === 'GeometryCollection'
  ) {
    return polygonsFromFeature({ type: 'Feature', geometry: geoJson, properties: {} });
  }
  return [];
}

/** Leaflet [lat, lng] rings from GeoJSON Polygon coordinates [lng, lat]. */
export function geoJsonPolygonToLatLngs(geometry) {
  if (!geometry || geometry.type !== 'Polygon') return [];
  return (geometry.coordinates || []).map((ring) =>
    ring.map(([lng, lat]) => [lat, lng])
  );
}

/**
 * Label for a polygon on the map and in the legend.
 *
 * Prefers the site name captured from the KML. Polygons ingested before names
 * were captured have none, so they fall back to the source file — and because a
 * single file can hold dozens of sites, that fallback is numbered
 * (`sites.kml (3/19)`) to keep otherwise identical rows distinguishable.
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
 * KML ExtendedData fields that are not the site name itself — lease numbers,
 * operators, and anything else the survey file carried.
 */
export function extraAttributes(properties) {
  if (!properties || typeof properties !== 'object') return [];

  const nameKeys = new Set(NAME_KEY_CANDIDATES);
  const rows = [];
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      continue;
    }
    const text = String(value).trim();
    if (!text) continue;
    if (nameKeys.has(normalizeKey(key))) continue;
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
