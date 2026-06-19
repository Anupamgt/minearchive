'use client';

import { useState } from 'react';
import './map.css';

const NODES = [
  { id: 1, name: 'Ropar North Quarry' },
  { id: 2, name: 'Sutlej River Pit' },
  { id: 3, name: 'Nangal Road Site' },
  { id: 4, name: 'Kiratpur Quarry' },
];

const UPLOADS = {
  1: [
    { id: 5, date: 'Jun 15, 2026', category: 'Routine Survey', user: 'Harpreet Singh' },
    { id: 4, date: 'May 02, 2026', category: 'Encroachment Report', user: 'Amit Sharma' },
    { id: 3, date: 'Mar 18, 2026', category: 'Routine Survey', user: 'Harpreet Singh' },
    { id: 2, date: 'Jan 10, 2026', category: 'Boundary Update', user: 'Priya Kaur' },
    { id: 1, date: 'Nov 22, 2025', category: 'Initial Survey', user: 'Amit Sharma' },
  ],
  2: [
    { id: 3, date: 'Jun 14, 2026', category: 'Encroachment Report', user: 'Amit Sharma' },
    { id: 2, date: 'Apr 20, 2026', category: 'Routine Survey', user: 'Harpreet Singh' },
    { id: 1, date: 'Feb 05, 2026', category: 'Initial Survey', user: 'Priya Kaur' },
  ],
  3: [
    { id: 4, date: 'Jun 13, 2026', category: 'Routine Survey', user: 'Harpreet Singh' },
    { id: 3, date: 'May 01, 2026', category: 'Restoration Check', user: 'Priya Kaur' },
    { id: 2, date: 'Mar 15, 2026', category: 'Routine Survey', user: 'Amit Sharma' },
    { id: 1, date: 'Dec 10, 2025', category: 'Initial Survey', user: 'Harpreet Singh' },
  ],
  4: [
    { id: 2, date: 'Jun 12, 2026', category: 'Restoration Check', user: 'Priya Kaur' },
    { id: 1, date: 'Mar 01, 2026', category: 'Initial Survey', user: 'Amit Sharma' },
  ],
};

const METRICS = {
  1: { area: '+12.3', areaPct: '+8.2%', perimeter: '+340' },
  2: { area: '-3.1', areaPct: '-2.4%', perimeter: '-85' },
  3: { area: '+5.7', areaPct: '+4.1%', perimeter: '+190' },
  4: { area: '+0.8', areaPct: '+1.2%', perimeter: '+45' },
};

export default function MapPage() {
  const [selectedNode, setSelectedNode] = useState(null);
  const [activeTab, setActiveTab] = useState('timeline');
  const [shownUploads, setShownUploads] = useState(new Set());

  const toggleShow = (uploadId) => {
    setShownUploads((prev) => {
      const next = new Set(prev);
      if (next.has(uploadId)) next.delete(uploadId);
      else next.add(uploadId);
      return next;
    });
  };

  const node = NODES.find((n) => n.id === selectedNode);
  const uploads = selectedNode ? UPLOADS[selectedNode] || [] : [];
  const metrics = selectedNode ? METRICS[selectedNode] : null;

  return (
    <div className="map-container">
      {/* Map Area */}
      <div className="map-area">
        <div className="map-placeholder">
          <div style={{ fontSize: 14, color: 'var(--text)' }}>
            Interactive Map — Ropar District
          </div>
          <div>ArcGIS / Leaflet integration pending</div>
          <div style={{ fontSize: 11 }}>
            Click a node below to open its directory
          </div>
        </div>
        <div className="map-node-buttons">
          {NODES.map((n) => (
            <button
              key={n.id}
              className={`map-node-btn${selectedNode === n.id ? ' selected' : ''}`}
              onClick={() => {
                setSelectedNode(n.id);
                setShownUploads(new Set());
              }}
            >
              {n.name}
            </button>
          ))}
        </div>
      </div>

      {/* Side Panel */}
      <div className="side-panel">
        {!selectedNode ? (
          <div className="side-panel-empty">
            Click a node on the map to view upload history
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="side-panel-header">
              <div className="side-panel-title">
                {node.name.toUpperCase()}
                <span className="tag tag-green">Active</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="side-panel-tabs">
              <button
                className={`side-panel-tab${activeTab === 'timeline' ? ' active' : ''}`}
                onClick={() => setActiveTab('timeline')}
              >
                Timeline
              </button>
              <button
                className={`side-panel-tab${activeTab === 'table' ? ' active' : ''}`}
                onClick={() => setActiveTab('table')}
              >
                Table
              </button>
            </div>

            {/* Body */}
            <div className="side-panel-body">
              {activeTab === 'timeline' ? (
                uploads.map((u) => (
                  <div className="timeline-entry" key={u.id}>
                    <div className="timeline-info">
                      <div>
                        <span className="timeline-id">#{u.id}</span>
                        <span className="timeline-date">{u.date}</span>
                      </div>
                      <div className="timeline-category">{u.category}</div>
                      <div className="timeline-user">{u.user}</div>
                    </div>
                    <button
                      className={`timeline-show${shownUploads.has(u.id) ? ' active' : ''}`}
                      onClick={() => toggleShow(u.id)}
                    >
                      {shownUploads.has(u.id) ? '✓ Show' : 'Show'}
                    </button>
                  </div>
                ))
              ) : (
                <table className="table table-compact" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Date</th>
                      <th>Category</th>
                      <th>User</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploads.map((u) => (
                      <tr key={u.id}>
                        <td style={{ color: 'var(--accent)' }}>{u.id}</td>
                        <td>{u.date}</td>
                        <td>{u.category}</td>
                        <td style={{ color: 'var(--muted)' }}>{u.user}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Change Metrics */}
            {metrics && (
              <div className="change-metrics">
                <div className="change-metrics-title">Change Metrics</div>
                <div className="change-metrics-row">
                  <div>
                    <span className="metric-label">Area: </span>
                    <span className={`metric-value ${parseFloat(metrics.area) >= 0 ? 'positive' : 'negative'}`}>
                      {metrics.area} ha ({metrics.areaPct})
                    </span>
                  </div>
                  <div>
                    <span className="metric-label">Perimeter: </span>
                    <span className={`metric-value ${parseFloat(metrics.perimeter) >= 0 ? 'positive' : 'negative'}`}>
                      {metrics.perimeter}m
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
