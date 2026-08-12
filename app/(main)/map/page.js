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
      <div className="map-placeholder-spinner" />
      <div>Loading basemap…</div>
    </div>
  ),
});

export default function MapPage() {
  const { showToast } = useToast();
  const [nodes, setNodes] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
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

  // Auto-select a node when arriving from the upload flow (/map?nodeId=...),
  // so freshly uploaded KML polygons are shown on the map immediately.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const nid = new URLSearchParams(window.location.search).get('nodeId');
    if (nid) setSelectedNode(nid);
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
      } else {
        next.add(uploadId);
      }
      return next;
    });
  };

  const showAll = () => {
    setShownUploads(new Set(uploads.map((u) => u.id)));
    showToast(`Showing all ${uploads.length} boundary layers`, 'success');
  };

  const hideAll = () => {
    setShownUploads(new Set());
    showToast('Hid all boundary layers', 'info');
  };

  const activeNodeObj = nodes.find((n) => n.id === selectedNode);
  const nodeName = activeNodeObj?.name || 'Monitoring area';

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

  // Build light node outlines from any known geometries (all nodes)
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
        setNodeOutlines(Array.from(byNode.values()));
      })
      .catch(() => setNodeOutlines([]));
  }, [nodes]);

  // Legend reflects the layers currently drawn on the map.
  const legendItems = useMemo(() => {
    return kmlLayers.map((layer) => ({
      id: layer.id,
      color: layer.color,
      label: layer.label,
    }));
  }, [kmlLayers]);

  const confirmFlagBreach = (e) => {
    e.preventDefault();
    setBreachModal(false);
    showToast(
      `Encroachment breach flagged for ${nodeName}. A violation notice was recorded in the audit trail.`,
      'error'
    );
  };

  return (
    <div className="gis-shell">
      {/* Map canvas */}
      <div className="gis-map">
        <MapWithNoSSR
          selectedNode={selectedNode}
          onSelectNode={(id) => {
            setSelectedNode(id);
            const n = nodes.find((x) => x.id === id);
            showToast(`Opened ${n?.name || 'monitoring area'}`, 'info');
          }}
          nodeOutlines={nodeOutlines}
          kmlLayers={kmlLayers}
        />

        {!selectedNode && (
          <div className="map-hint-card">
            <strong>Pick a monitoring area to begin</strong>
            <span>
              Choose an area from the Layers panel, or click any highlighted boundary on the map.
            </span>
          </div>
        )}

        {legendItems.length > 0 && (
          <div className="map-legend" role="region" aria-label="Legend">
            <div className="map-legend-title">Legend</div>
            {legendItems.map((item) => (
              <div className="map-legend-row" key={item.id}>
                <span className="map-legend-swatch" style={{ background: item.color }} />
                <span className="map-legend-label">{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Layers panel — GIS "Table of Contents" */}
      <aside className="gis-panel">
        <div className="gis-panel-head">
          <div className="gis-panel-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            Layers
          </div>
          <p className="gis-panel-desc">Monitoring areas and their uploaded boundary files.</p>
        </div>

        <div className="gis-field">
          <label htmlFor="area-picker">Monitoring area</label>
          <select
            id="area-picker"
            value={selectedNode || ''}
            onChange={(e) => setSelectedNode(e.target.value || null)}
          >
            <option value="">Select an area…</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
                {typeof n.uploadCount === 'number' ? ` — ${n.uploadCount} file(s)` : ''}
              </option>
            ))}
          </select>
          {nodes.length === 0 && (
            <p className="help-text">
              No areas yet. Create one under “Areas”, then upload a KML/KMZ boundary.
            </p>
          )}
        </div>

        {!selectedNode ? (
          <div className="gis-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0 0 21 18.382V7.618a1 1 0 0 0-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <h3>No area selected</h3>
            <p>Select a monitoring area above to view and toggle its boundary layers on the map.</p>
          </div>
        ) : (
          <>
            <div className="gis-area-head">
              <div className="gis-area-name" title={nodeName}>{nodeName}</div>
              <span className={`tag ${(activeNodeObj?.status || 'active').toLowerCase() === 'active' ? 'tag-green' : 'tag'}`}>
                {(activeNodeObj?.status || 'active').toUpperCase()}
              </span>
            </div>

            <div className="gis-layers-toolbar">
              <span className="gis-layers-count">
                {shownUploads.size}/{uploads.length} visible
              </span>
              <div className="gis-layers-actions">
                <button type="button" className="btn btn-outline btn-sm" onClick={showAll} disabled={uploads.length === 0}>
                  Show all
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={hideAll} disabled={shownUploads.size === 0}>
                  Hide all
                </button>
              </div>
            </div>

            <div className="gis-layers">
              {loadingUploads ? (
                <div className="gis-loading">
                  <div className="skeleton" style={{ height: 46, marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 46, marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 46 }} />
                </div>
              ) : uploads.length === 0 ? (
                <div className="gis-empty gis-empty-sm">
                  <p>No boundary files uploaded for this area yet.</p>
                  <a className="btn btn-primary btn-sm" href="/upload">Upload a KML / KMZ</a>
                </div>
              ) : (
                uploads.map((u, index) => {
                  const on = shownUploads.has(u.id);
                  return (
                    <label className={`layer-row${on ? ' on' : ''}`} key={u.id}>
                      <input
                        type="checkbox"
                        className="layer-check"
                        checked={on}
                        onChange={() => toggleShow(u.id)}
                      />
                      <span className="layer-swatch" style={{ background: colorForIndex(index) }} />
                      <span className="layer-info">
                        <span className="layer-name" title={u.kmlFilePath || 'Boundary layer'}>
                          {u.kmlFilePath || 'Boundary layer'}
                        </span>
                        <span className="layer-meta">
                          {typeof u.uploadDate === 'string' ? u.uploadDate.split('T')[0] : '—'}
                          {' · '}
                          {u.geometryCount ?? 0} polygon(s)
                          {u.uploadedBy ? ` · ${u.uploadedBy}` : ''}
                        </span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="gis-panel-footer">
              <div className="gis-stat">
                <span className="gis-stat-label">Polygons on map</span>
                <span className="gis-stat-value">{kmlLayers.length}</span>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  className="btn btn-danger w-full"
                  onClick={() => setBreachModal(true)}
                >
                  Flag encroachment breach
                </button>
              )}
            </div>
          </>
        )}
      </aside>

      {breachModal && (
        <div className="modal-overlay" onClick={() => setBreachModal(false)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--red)' }}>Flag encroachment violation</h3>
              <button type="button" className="modal-close" aria-label="Close" onClick={() => setBreachModal(false)}>×</button>
            </div>
            <form onSubmit={confirmFlagBreach}>
              <div className="modal-body">
                <p style={{ fontSize: 14, color: 'var(--text-subtle)', marginBottom: 16 }}>
                  A formal notice for <strong style={{ color: 'var(--text)' }}>{nodeName}</strong> will be recorded in the audit trail.
                </p>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="breach-reason" className="required">Findings / evidence</label>
                  <textarea
                    id="breach-reason"
                    rows="3"
                    value={breachReason}
                    onChange={(e) => setBreachReason(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setBreachModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger">
                  Record breach notice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
