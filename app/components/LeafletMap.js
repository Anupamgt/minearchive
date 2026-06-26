'use client';

import { MapContainer, TileLayer, Polygon, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Ropar District coordinates
const CENTER = [30.97, 76.53];
const ZOOM = 11;

const NODE_POLYGONS = {
  1: {
    color: '#007acc',
    positions: [
      [30.98, 76.52],
      [30.99, 76.54],
      [30.975, 76.545],
      [30.97, 76.53],
    ]
  },
  2: {
    color: '#22c55e',
    positions: [
      [30.95, 76.51],
      [30.96, 76.52],
      [30.945, 76.53],
      [30.94, 76.515],
    ]
  },
  3: {
    color: '#f59e0b',
    positions: [
      [31.02, 76.55],
      [31.03, 76.57],
      [31.015, 76.58],
      [31.01, 76.56],
    ]
  },
  4: {
    color: '#ef4444',
    positions: [
      [31.06, 76.52],
      [31.07, 76.54],
      [31.055, 76.55],
      [31.05, 76.53],
    ]
  }
};

export default function LeafletMap({ selectedNode, onSelectNode }) {
  return (
    <MapContainer
      center={CENTER}
      zoom={ZOOM}
      style={{ height: '100%', width: '100%', background: '#1e1e1e' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {Object.entries(NODE_POLYGONS).map(([idStr, geom]) => {
        const id = parseInt(idStr);
        const isSelected = selectedNode === id;
        return (
          <Polygon
            key={id}
            positions={geom.positions}
            pathOptions={{
              color: isSelected ? '#4fc1ff' : geom.color,
              weight: isSelected ? 4 : 2,
              fillColor: geom.color,
              fillOpacity: isSelected ? 0.6 : 0.3,
            }}
            eventHandlers={{
              click: () => onSelectNode(id)
            }}
          >
            <Tooltip direction="center" permanent={isSelected}>
              {id === 1 && 'Ropar North Quarry'}
              {id === 2 && 'Sutlej River Pit'}
              {id === 3 && 'Nangal Road Site'}
              {id === 4 && 'Kiratpur Quarry'}
            </Tooltip>
          </Polygon>
        );
      })}
    </MapContainer>
  );
}
