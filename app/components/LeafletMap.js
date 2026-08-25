'use client';

import { useEffect, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Polygon,
  Tooltip,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { colorForIndex, geoJsonPolygonToLatLngs } from '../../lib/kml';

const CENTER = [30.97, 76.53];
const ZOOM = 11;

function FitBounds({ layers }) {
  const map = useMap();

  useEffect(() => {
    const latLngs = [];
    for (const layer of layers || []) {
      for (const ring of layer.positions || []) {
        for (const ll of ring) latLngs.push(ll);
      }
    }
    if (latLngs.length > 0) {
      map.fitBounds(latLngs, { padding: [28, 28], maxZoom: 15 });
    }
  }, [layers, map]);

  return null;
}

/**
 * @param {object} props
 * @param {string|null} props.selectedNode
 * @param {(id: string) => void} props.onSelectNode
 * @param {Array<{ id: string, name: string, color?: string, positions: number[][][] }>} props.nodeOutlines
 * @param {Array<{ id: string, uploadId: string, label?: string, color?: string, positions: number[][][] }>} props.kmlLayers
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

      <FitBounds layers={fitSource} />

      {nodeOutlines.map((node) => {
        const isSelected = selectedNode === node.id;
        return (
          <Polygon
            key={`node-${node.id}`}
            positions={node.positions}
            pathOptions={{
              color: isSelected ? '#4fc1ff' : node.color || '#64748b',
              weight: isSelected ? 3 : 1.5,
              fillColor: node.color || '#64748b',
              fillOpacity: isSelected ? 0.25 : 0.1,
              dashArray: overlayLayers.length > 0 ? '6 4' : undefined,
            }}
            eventHandlers={{
              click: () => onSelectNode?.(node.id),
            }}
          >
            <Tooltip direction="top" sticky>
              {node.name}
            </Tooltip>
          </Polygon>
        );
      })}

      {overlayLayers.map((layer) => {
        const isSelectedSite = selectedLayerId && selectedLayerId === layer.id;
        const isSelectedFile =
          selectedUploadId && selectedUploadId === layer.uploadId;
        const dimOthers = Boolean(selectedUploadId) && !isSelectedFile;

        return (
          <Polygon
            key={`kml-${layer.id}`}
            positions={layer.positions}
            pathOptions={{
              color: layer.color,
              weight: isSelectedSite ? 4 : isSelectedFile ? 3 : dimOthers ? 1.5 : 2.5,
              fillColor: layer.color,
              fillOpacity: isSelectedSite
                ? 0.55
                : isSelectedFile
                  ? 0.4
                  : dimOthers
                    ? 0.1
                    : 0.32,
            }}
            eventHandlers={{
              click: () => onSelectLayer?.(layer),
            }}
          >
            <Tooltip direction="center" permanent={overlayLayers.length <= 3 && !selectedLayerId}>
              {layer.label || layer.uploadId}
            </Tooltip>
          </Polygon>
        );
      })}
    </MapContainer>
  );
}

export { geoJsonPolygonToLatLngs, colorForIndex };
