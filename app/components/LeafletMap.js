'use client';

import { useEffect, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Polygon,
  Polyline,
  CircleMarker,
  Tooltip,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  colorForIndex,
  geoJsonPolygonToLatLngs,
  leafletLatLngsFromLayer,
} from '../../lib/kml';

const CENTER = [30.97, 76.53];
const ZOOM = 11;

function fitMapToLatLngs(map, latLngs, { maxZoom = 15, padding = [28, 28] } = {}) {
  if (!map || !latLngs?.length) return;
  if (latLngs.length === 1) {
    map.setView(latLngs[0], Math.min(maxZoom, 16));
    return;
  }
  map.fitBounds(latLngs, { padding, maxZoom });
}

function FitBounds({ layers, selectedUploadId, disabled }) {
  const map = useMap();

  useEffect(() => {
    if (disabled) return;
    const selected = (layers || []).filter(
      (layer) => selectedUploadId && layer.uploadId === selectedUploadId
    );
    const source = selected.length > 0 ? selected : layers;
    const latLngs = [];
    for (const layer of source || []) {
      for (const ll of leafletLatLngsFromLayer(layer)) latLngs.push(ll);
    }
    fitMapToLatLngs(map, latLngs);
  }, [layers, map, selectedUploadId, disabled]);

  return null;
}

function ZoomToFeature({ layers, highlightId }) {
  const map = useMap();

  useEffect(() => {
    if (!highlightId) return;
    const layer = (layers || []).find((item) => item.id === highlightId);
    if (!layer) return;
    const latLngs = leafletLatLngsFromLayer(layer);
    fitMapToLatLngs(map, latLngs, { maxZoom: 17, padding: [48, 48] });
  }, [highlightId, layers, map]);

  return null;
}

function MapFeature({ layer, highlighted, pathOptions, eventHandlers, children }) {
  const type = layer.geomType || 'Polygon';

  if (type === 'Point') {
    return (
      <CircleMarker
        center={layer.positions}
        radius={highlighted ? 11 : 7}
        pathOptions={pathOptions}
        eventHandlers={eventHandlers}
      >
        {children}
      </CircleMarker>
    );
  }

  if (type === 'LineString') {
    return (
      <Polyline
        positions={layer.positions}
        pathOptions={pathOptions}
        eventHandlers={eventHandlers}
      >
        {children}
      </Polyline>
    );
  }

  return (
    <Polygon
      positions={layer.positions}
      pathOptions={pathOptions}
      eventHandlers={eventHandlers}
    >
      {children}
    </Polygon>
  );
}

/**
 * @param {object} props
 * @param {string|null} props.selectedNode
 * @param {(id: string) => void} props.onSelectNode
 * @param {Array<{ id: string, name: string, color?: string, geomType?: string, positions: any }>} props.nodeOutlines
 * @param {Array<{ id: string, uploadId: string, label?: string, color?: string, geomType?: string, positions: any }>} props.kmlLayers
 * @param {string|null} props.selectedUploadId
 * @param {string|null} props.selectedLayerId
 * @param {(layer: object) => void} props.onSelectLayer
 */
export default function LeafletMap({
  selectedNode,
  onSelectNode,
  nodeOutlines = [],
  kmlLayers = [],
  selectedUploadId = null,
  selectedLayerId = null,
  onSelectLayer,
}) {
  const overlayLayers = useMemo(() => {
    return (kmlLayers || []).map((layer, index) => ({
      ...layer,
      color: layer.color || colorForIndex(index),
    }));
  }, [kmlLayers]);

  const sortedOverlays = useMemo(() => {
    if (!selectedLayerId) return overlayLayers;
    return [...overlayLayers].sort((a, b) => {
      if (a.id === selectedLayerId) return 1;
      if (b.id === selectedLayerId) return -1;
      return 0;
    });
  }, [overlayLayers, selectedLayerId]);

  const fitSource = overlayLayers.length > 0 ? overlayLayers : nodeOutlines;

  return (
    <MapContainer
      center={CENTER}
      zoom={ZOOM}
      style={{ height: '100%', width: '100%', background: '#eef2f6' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitBounds
        layers={fitSource}
        selectedUploadId={selectedUploadId}
        disabled={Boolean(selectedLayerId)}
      />
      <ZoomToFeature layers={overlayLayers} highlightId={selectedLayerId} />

      {nodeOutlines.map((node) => {
        const isSelected = selectedNode === node.id;
        return (
          <MapFeature
            key={`node-${node.id}`}
            layer={node}
            highlighted={isSelected}
            pathOptions={{
              color: isSelected ? '#4fc1ff' : node.color || '#64748b',
              weight: isSelected ? 3 : 1.5,
              fillColor: node.color || '#64748b',
              fillOpacity: node.geomType === 'Point' ? (isSelected ? 0.9 : 0.55) : isSelected ? 0.25 : 0.1,
              dashArray: overlayLayers.length > 0 ? '6 4' : undefined,
            }}
            eventHandlers={{
              click: () => onSelectNode?.(node.id),
            }}
          >
            <Tooltip direction="top" sticky>
              {node.name}
            </Tooltip>
          </MapFeature>
        );
      })}

      {sortedOverlays.map((layer) => {
        const isSelectedSite = selectedLayerId && selectedLayerId === layer.id;
        const isSelectedFile = selectedUploadId && selectedUploadId === layer.uploadId;
        const dimOthers = Boolean(selectedUploadId) && !isSelectedFile;
        const isPoint = layer.geomType === 'Point';
        const isLine = layer.geomType === 'LineString';
        return (
          <MapFeature
            key={`kml-${layer.id}`}
            layer={layer}
            highlighted={isSelectedSite}
            pathOptions={{
              color: layer.color,
              weight: isSelectedSite
                ? isPoint
                  ? 3
                  : 5
                : isSelectedFile
                  ? isLine
                    ? 4
                    : 3
                  : dimOthers
                    ? 1.5
                    : isLine
                      ? 3.5
                      : 2.5,
              fillColor: layer.color,
              fillOpacity: isPoint
                ? 0.92
                : isLine
                  ? 0
                  : isSelectedSite
                    ? 0.55
                    : isSelectedFile
                      ? 0.4
                      : dimOthers
                        ? 0.1
                        : 0.32,
            }}
            eventHandlers={{
              click: (event) => {
                event.originalEvent?.stopPropagation?.();
                onSelectLayer?.(layer);
              },
            }}
          >
            <Tooltip direction="top" sticky permanent={overlayLayers.length <= 3 && !selectedLayerId}>
              {layer.label || layer.uploadId}
            </Tooltip>
          </MapFeature>
        );
      })}
    </MapContainer>
  );
}

export { geoJsonPolygonToLatLngs, colorForIndex };
