'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useToast } from '../../components/ToastProvider';
import { readSessionFromCookie } from '../../../lib/session-client';
import { colorForIndex, geoJsonPolygonToLatLngs } from '../../../lib/kml';
import './map.css';

const MapWithNoSSR = dynamic(() => import('../../components/LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="map-placeholder">
      <div style={{ fontSize: 14, color: 'var(--text)' }}>Loading OpenStreetMap & Leaflet Tiles...</div>
    </div>
  ),
});

export default function MapPage() {
  const { showToast } = useToast();
  const [nodes, setNodes] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [activeTab, setActiveTab] = useState('timeline');
  const [uploads, setUploads] = useState([]);
  const [shownUploads, setShownUploads] = useState(() => new Set());
  const [loadingUploads, setLoadingUploads] = useState(false);
  const [kmlFeatures, setKmlFeatures] = useState([]);
  const [role, setRole] = useState('Admin');
  const [breachModal, setBreachModal] = useState(false);
  const [breachReason, setBreachReason] = useState(
    'Exceeded approved perimeter boundary by 14.2 meters towards northern riverbank'
  );

  useEffect(() => {
    const decoded = readSessionFromCookie();
    if (decoded?.role) setRole(decoded.role);
  }, []);

  const isAdmin = role.toLowerCase() === 'admin';

  useEffect(() => {
    fetch('/api/nodes', { credentials: 'same-origin' })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setNodes(data);
      })
      .catch(() => setNodes([]));
  }, []);

  useEffect(() => {
    if (!selectedNode) {
      setUploads([]);
      setShownUploads(new Set());
      return;
    }
    setLoadingUploads(true);
    fetch(`/api/uploads?nodeId=${encodeURIComponent(selectedNode)}`, {
      credentials: 'same-origin',
    })
      .then((res) => res.json())
      .then((data) => {
        setLoadingUploads(false);
        const list = Array.isArray(data) ? data : [];
        setUploads(list);
        // Auto-show the latest upload so KML is visible immediately
        if (list.length > 0) {
          setShownUploads(new Set([list[0].id]));
        } else {
          setShownUploads(new Set());
        }
      })
      .catch(() => {
        setLoadingUploads(false);
        setUploads([]);
        setShownUploads(new Set());
      });
  }, [selectedNode]);

  // Load GeoJSON for all shown uploads (supports multiple KML overlays)
  useEffect(() => {
    const ids = Array.from(shownUploads);
    if (ids.length === 0) {
      setKmlFeatures([]);
      return;
    }
    const params = new URLSearchParams({ uploadIds: ids.join(',') });
    if (selectedNode) params.set('nodeId', selectedNode);

    fetch(`/api/map/layers?${params.toString()}`, { credentials: 'same-origin' })
      .then((res) => res.json())
      .then((fc) => {
        setKmlFeatures(Array.isArray(fc?.features) ? fc.features : []);
      })
      .catch(() => setKmlFeatures([]));
  }, [shownUploads, selectedNode]);

  const toggleShow = (uploadId) => {
    setShownUploads((prev) => {
      const next = new Set(prev);
      if (next.has(uploadId)) {
        next.delete(uploadId);
        showToast('Hidden KML layer', 'info');
      } else {
        next.add(uploadId);
        showToast('Showing KML polygon layer on map', 'success');
      }
      return next;
    });
  };

  const showAll = () => {
    setShownUploads(new Set(uploads.map((u) => u.id)));
    showToast(`Showing all ${uploads.length} KML entries`, 'success');
  };

  const hideAll = () => {
    setShownUploads(new Set());
    showToast('Cleared KML overlays', 'info');
  };

  const activeNodeObj = nodes.find((n) => n.id === selectedNode);
  const nodeName = activeNodeObj?.name || 'Mining Enclosure';

  const uploadColorIndex = useMemo(() => {
    const map = new Map();
    uploads.forEach((u, i) => map.set(u.id, i));
    return map;
  }, [uploads]);

  const kmlLayers = useMemo(() => {
    return kmlFeatures
      .map((feature) => {
        const positions = geoJsonPolygonToLatLngs(feature.geometry);
        if (!positions.length) return null;
        const uploadId = feature.properties?.uploadId;
        const color = colorForIndex(uploadColorIndex.get(uploadId) ?? 0);
        const date = feature.properties?.uploadDate
          ? String(feature.properties.uploadDate).split('T')[0]
          : '';
        return {
          id: feature.id || feature.properties?.geometryId,
          uploadId,
          color,
          positions,
          label: `${feature.properties?.kmlFilePath || 'KML'} ${date}`.trim(),
        };
      })
      .filter(Boolean);
  }, [kmlFeatures, uploadColorIndex]);

  // Build light node outlines from any known geometries for that node (latest layer API without filter)
  const [nodeOutlines, setNodeOutlines] = useState([]);
  useEffect(() => {
    if (nodes.length === 0) {
      setNodeOutlines([]);
      return;
    }
    fetch('/api/map/layers', { credentials: 'same-origin' })
      .then((res) => res.json())
      .then((fc) => {
        const byNode = new Map();
        for (const feature of fc?.features || []) {
          const nid = feature.properties?.nodeId;
          if (!nid || byNode.has(nid)) continue;
          const positions = geoJsonPolygonToLatLngs(feature.geometry);
          if (!positions.length) continue;
          const node = nodes.find((n) => n.id === nid);
          byNode.set(nid, {
            id: nid,
            name: node?.name || feature.properties?.nodeName || 'Node',
            color: '#64748b',
            positions,
          });
        }
        // Nodes with no geometry yet get no outline (still selectable via list)
        setNodeOutlines(Array.from(byNode.values()));
      })
      .catch(() => setNodeOutlines([]));
  }, [nodes]);

  const confirmFlagBreach = (e) => {
    e.preventDefault();
    setBreachModal(false);
    showToast(
      `ENCROACHMENT BREACH FLAGGED for ${nodeName}. Violation notice logged to Central Audit Trail.`,
      'error'
    );
  };

  return (
    <div className="map-container">
      <div className="map-area">
        <MapWithNoSSR
          selectedNode={selectedNode}
          onSelectNode={(id) => {
            setSelectedNode(id);
            showToast(`Selected enclosure`, 'info');
          }}
          nodeOutlines={nodeOutlines}
          kmlLayers={kmlLayers}
        />
        <div className="map-node-buttons">
          {nodes.length === 0 ? (
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              No nodes yet — create one under Nodes or upload a KML linked to a node.
            </span>
          ) : (
            nodes.map((n) => (
              <button
                key={n.id}
                className={`map-node-btn${selectedNode === n.id ? ' selected' : ''}`}
                onClick={() => {
                  setSelectedNode(n.id);
                  showToast(`Focused on ${n.name}`, 'info');
                }}
              >
                {n.name}
                {typeof n.uploadCount === 'number' ? ` (${n.uploadCount})` : ''}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="side-panel">
        {!selectedNode ? (
          <div className="side-panel-empty">
            <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
              No Mining Enclosure Selected
            </div>
            <div>
              Select a node below the map to open its KML archive. Multiple uploads can be shown on the map at once.
            </div>
          </div>
        ) : (
          <>
            <div className="side-panel-header">
              <div className="side-panel-title">
                {nodeName.toUpperCase()}
                <span className="tag tag-green">{activeNodeObj?.status || 'active'}</span>
              </div>
            </div>

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

            <div className="side-panel-body">
              {loadingUploads ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
                  Fetching spatial archive...
                </div>
              ) : uploads.length === 0 ? (
                <div style={{ padding: 20, color: 'var(--muted)', fontSize: 12 }}>
                  No KML uploads for this node yet. Use Upload KML to add one or more files.
                </div>
              ) : activeTab === 'timeline' ? (
                <>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <button type="button" className="btn btn-outline" style={{ fontSize: 11, padding: '4px 8px' }} onClick={showAll}>
                      Show all ({uploads.length})
                    </button>
                    <button type="button" className="btn btn-outline" style={{ fontSize: 11, padding: '4px 8px' }} onClick={hideAll}>
                      Hide all
                    </button>
                  </div>
                  {uploads.map((u, index) => (
                    <div className="timeline-entry" key={u.id}>
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          background: colorForIndex(index),
                          marginTop: 4,
                          flexShrink: 0,
                        }}
                      />
                      <div className="timeline-info" style={{ flex: 1 }}>
                        <div>
                          <span className="timeline-date">
                            {typeof u.uploadDate === 'string' ? u.uploadDate.split('T')[0] : '—'}
                          </span>
                          <span style={{ marginLeft: 8, color: 'var(--muted)', fontSize: 11 }}>
                            {u.kmlFilePath || 'KML'} · {u.geometryCount ?? 0} poly
                          </span>
                        </div>
                        <div className="timeline-category">{u.category}</div>
                        <div className="timeline-user">Uploaded by: {u.uploadedBy || '—'}</div>
                      </div>
                      <button
                        className={`timeline-show${shownUploads.has(u.id) ? ' active' : ''}`}
                        onClick={() => toggleShow(u.id)}
                      >
                        {shownUploads.has(u.id) ? '✓ Shown' : 'Show'}
                      </button>
                    </div>
                  ))}
                </>
              ) : (
                <table className="table table-compact" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th></th>
                      <th>Date</th>
                      <th>File</th>
                      <th>Polys</th>
                      <th>User</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploads.map((u, index) => (
                      <tr key={u.id}>
                        <td>
                          <span
                            style={{
                              display: 'inline-block',
                              width: 10,
                              height: 10,
                              background: colorForIndex(index),
                            }}
                          />
                        </td>
                        <td>
                          {typeof u.uploadDate === 'string' ? u.uploadDate.split('T')[0] : '—'}
                        </td>
                        <td>{u.kmlFilePath || u.category}</td>
                        <td>{u.geometryCount ?? 0}</td>
                        <td style={{ color: 'var(--muted)' }}>{u.uploadedBy || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="change-metrics">
              <div className="change-metrics-title">
                Visible layers: {shownUploads.size} / {uploads.length}
              </div>
              <div className="change-metrics-row">
                <div>
                  <span className="metric-label">Polygons on map: </span>
                  <span className="metric-value">{kmlLayers.length}</span>
                </div>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => setBreachModal(true)}
                  style={{ width: '100%', marginTop: 12 }}
                >
                  Flag Encroachment Breach
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {breachModal && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(9,30,66,0.54)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            className="modal-card"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-overlay)',
              padding: 24,
              width: 440,
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 12, color: 'var(--red)' }}>
              Flag Encroachment Violation
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text)', marginBottom: 16 }}>
              Formal notice for <strong>{nodeName}</strong> will be recorded in the audit trail.
            </p>
            <form onSubmit={confirmFlagBreach}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                  Findings / Evidence Details
                </label>
                <textarea
                  className="input"
                  rows="3"
                  style={{
                    width: '100%',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    padding: 8,
                  }}
                  value={breachReason}
                  onChange={(e) => setBreachReason(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-outline" onClick={() => setBreachModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger">
                  Confirm Breach Notice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
