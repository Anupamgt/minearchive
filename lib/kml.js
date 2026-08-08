/**
 * Helpers for turning KML → GeoJSON polygons we can store in PostGIS.
 */

/** Drop altitude (Z) from coordinate arrays — PostGIS Polygon,4326 is 2D. */
function force2DCoords(coords) {
  if (!Array.isArray(coords)) return coords;
  if (typeof coords[0] === 'number') return coords.slice(0, 2);
  return coords.map(force2DCoords);
}

/** Extract Polygon geometries from a GeoJSON feature (explodes MultiPolygon). */
export function polygonsFromFeature(feature) {
  if (!feature?.geometry) return [];
  const { type, coordinates } = feature.geometry;
  if (type === 'Polygon') {
    return [
      {
        type: 'Polygon',
        coordinates: force2DCoords(coordinates),
        properties: feature.properties || {},
      },
    ];
  }
  if (type === 'MultiPolygon') {
    return coordinates.map((coords) => ({
      type: 'Polygon',
      coordinates: force2DCoords(coords),
      properties: feature.properties || {},
    }));
  }
  return [];
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
  if (geoJson.type === 'Polygon' || geoJson.type === 'MultiPolygon') {
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
