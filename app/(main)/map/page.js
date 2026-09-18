'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useToast } from '../../components/ToastProvider';
import { readSessionFromCookie } from '../../../lib/session-client';
import {
  colorForIndex,
  geoJsonToLeafletPositions,
  describeGeomType,
} from '../../../lib/kml';
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

function featureKey(feature) {
  return feature?.id || feature?.properties?.geometryId;
}

function normalizeGeomType(type) {
  if (type === 'MultiPolygon') return 'Polygon';
  if (type === 'MultiLineString') return 'LineString';
  if (type === 'MultiPoint') return 'Point';
  return type || 'Polygon';
}

function layerFromGeometry(feature, extra = {}) {
  const geometry = feature?.geometry;
  const geomType = normalizeGeomType(feature?.properties?.geomType || geometry?.type);
  const positions = geoJsonToLeafletPositions(geometry);
  if (!positions) return null;
  if (geomType === 'Point') {
    if (!Number.isFinite(positions[0]) || !Number.isFinite(positions[1])) return null;
  } else if (!positions.length) {
    return null;
  }
  return { geomType, positions, ...extra };
}

function filenameFromDisposition(header, fallback) {
  if (!header) return fallback;
  const star = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      return star[1].trim();
    }
  }
  const quoted = /filename\s*=\s*"([^"]+)"/i.exec(header);
  if (quoted?.[1]) return quoted[1];
  const plain = /filename\s*=\s*([^;]+)/i.exec(header);
  return plain?.[1]?.trim() || fallback;
}

async function downloadAuthenticated(url, fallbackName, { method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Download failed');
  }
  const blob = await res.blob();
  const name = filenameFromDisposition(res.headers.get('Content-Disposition'), fallbackName);
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

function featureMeasureLines(props) {
  const type = props?.geomType;
  const lines = [];
  if (type === 'LineString') {
    const m = Number(props.perimeterMeters);
    if (Number.isFinite(m)) {
      lines.push(`Length ${m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(1)} m`}`);
    }
    return lines;
  }
  if (type === 'Point') return lines;
  const area = Number(props?.areaHectares);
  if (Number.isFinite(area)) lines.push(`Area ${area.toFixed(2)} ha`);
  const peri = Number(props?.perimeterMeters);
  if (Number.isFinite(peri)) {
    lines.push(`Perimeter ${peri >= 1000 ? `${(peri / 1000).toFixed(2)} km` : `${peri.toFixed(1)} m`}`);
  }
  return lines;
}

export default function MapPage() {
  const { showToast } = useToast();
  const [nodes, setNodes] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [shownUploads, setShownUploads] = useState(() => new Set());
  const [downloadSelected, setDownloadSelected] = useState(() => new Set());
  const [selectedFeatureId, setSelectedFeatureId] = useState(null);
  const [loadingUploads, setLoadingUploads] = useState(false);
  const [exporting, setExporting] = useState(false);
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
  // so freshly uploaded KML features are shown on the map immediately.
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
      setDownloadSelected(new Set());
      setSelectedFeatureId(null);
      return;
    }
    setLoadingUploads(true);
    setDownloadSelected(new Set());
    setSelectedFeatureId(null);
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

  const toggleDownloadSelect = (uploadId) => {
    setDownloadSelected((prev) => {
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

  const handleDownload = async (url, fallbackName, options) => {
    try {
      await downloadAuthenticated(url, fallbackName, options);
    } catch (err) {
      showToast(err.message || 'Download failed', 'error');
    }
  };

  const downloadFileKml = (upload) => {
    const fallback = upload.kmlFilePath?.replace(/\.kmz$/i, '.kml') || 'layer.kml';
    return handleDownload(`/api/uploads/${encodeURIComponent(upload.id)}/kml`, fallback);
  };

  const downloadFeatureKml = (featureId, name) => {
    const fallback = `${name || 'feature'}.kml`;
    return handleDownload(`/api/geometries/${encodeURIComponent(featureId)}/kml`, fallback);
  };

  const exportSelected = async (mode) => {
    const uploadIds = Array.from(downloadSelected);
    if (uploadIds.length === 0) {
      showToast('Tick one or more files to download.', 'warning');
      return;
    }
    setExporting(true);
    try {
      await downloadAuthenticated(
        '/api/uploads/export',
        mode === 'separate' ? 'selected-kml-files.zip' : 'combined-export.kml',
        { method: 'POST', body: { uploadIds, mode } }
      );
    } catch (err) {
      showToast(err.message || 'Download failed', 'error');
    } finally {
      setExporting(false);
    }
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
        const uploadId = feature.properties?.uploadId;
        const color = colorForIndex(uploadColorIndex.get(uploadId) ?? 0);
        const name = feature.properties?.name || feature.properties?.kmlFilePath || 'Untitled';
        const layer = layerFromGeometry(feature, {
          id: featureKey(feature),
          uploadId,
          color,
          name,
          label: name,
        });
        return layer;
      })
      .filter(Boolean);
  }, [kmlFeatures, uploadColorIndex]);

  useEffect(() => {
    if (selectedFeatureId && !kmlLayers.some((layer) => layer.id === selectedFeatureId)) {
      setSelectedFeatureId(null);
    }
  }, [kmlLayers, selectedFeatureId]);

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
          const node = nodes.find((n) => n.id === nid);
          const layer = layerFromGeometry(feature, {
            id: nid,
            name: node?.name || feature.properties?.nodeName || 'Node',
            color: '#64748b',
          });
          if (layer) byNode.set(nid, layer);
        }
        setNodeOutlines(Array.from(byNode.values()));
      })
      .catch(() => setNodeOutlines([]));
  }, [nodes]);

  const legendItems = useMemo(() => kmlLayers, [kmlLayers]);

  const selectedFeature = useMemo(
    () => kmlFeatures.find((feature) => featureKey(feature) === selectedFeatureId) || null,
    [kmlFeatures, selectedFeatureId]
  );

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
          onSelectFeature={(id) => setSelectedFeatureId(id)}
          highlightId={selectedFeatureId}
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

        {selectedFeature && (
          <div className="map-inspector" role="dialog" aria-label="Feature details">
            <div className="map-inspector-head">
              <strong>{selectedFeature.properties?.name || 'Untitled feature'}</strong>
              <button
                type="button"
                className="map-inspector-close"
                aria-label="Close feature details"
                onClick={() => setSelectedFeatureId(null)}
              >
                ×
              </button>
            </div>
            <div className="map-inspector-meta">
              <span>
                Type:{' '}
                {describeGeomType(normalizeGeomType(selectedFeature.properties?.geomType))}
              </span>
              {featureMeasureLines(selectedFeature.properties).map((line) => (
                <span key={line}>{line}</span>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() =>
                downloadFeatureKml(
                  featureKey(selectedFeature),
                  selectedFeature.properties?.name
                )
              }
            >
              Download this feature
            </button>
          </div>
        )}

        {legendItems.length > 0 && (
          <div className="map-legend" role="region" aria-label="Legend">
            <div className="map-legend-title">Legend</div>
            {legendItems.map((item) => (
              <div
                className={`map-legend-item${selectedFeatureId === item.id ? ' active' : ''}`}
                key={item.id}
              >
                <button
                  type="button"
                  className="map-legend-row"
                  onClick={() => setSelectedFeatureId(item.id)}
                >
                  <span className="map-legend-swatch" style={{ background: item.color }} />
                  <span className="map-legend-label">
                    {item.label} · {describeGeomType(item.geomType)}
                  </span>
                </button>
                <button
                  type="button"
                  className="map-legend-dl"
                  title="Download this feature"
                  onClick={() => downloadFeatureKml(item.id, item.label)}
                >
                  Download
                </button>
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

            <div className="gis-layers-toolbar gis-download-toolbar">
              <span className="gis-layers-count">
                {downloadSelected.size} ticked
              </span>
              <div className="gis-layers-actions">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => exportSelected('separate')}
                  disabled={downloadSelected.size === 0 || exporting}
                >
                  Download selected separately
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => exportSelected('combined')}
                  disabled={downloadSelected.size === 0 || exporting}
                >
                  Download combined
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
                  const picked = downloadSelected.has(u.id);
                  return (
                    <div className={`layer-row${on ? ' on' : ''}${picked ? ' picked' : ''}`} key={u.id}>
                      <input
                        type="checkbox"
                        className="layer-check"
                        checked={on}
                        onChange={() => toggleShow(u.id)}
                        title="Show on map"
                        aria-label={`Show ${u.kmlFilePath || 'layer'} on map`}
                      />
                      <input
                        type="checkbox"
                        className="layer-check layer-check-download"
                        checked={picked}
                        onChange={() => toggleDownloadSelect(u.id)}
                        title="Select for download"
                        aria-label={`Select ${u.kmlFilePath || 'layer'} for download`}
                      />
                      <span className="layer-swatch" style={{ background: colorForIndex(index) }} />
                      <span className="layer-info">
                        <span className="layer-name" title={u.kmlFilePath || 'Boundary layer'}>
                          {u.kmlFilePath || 'Boundary layer'}
                        </span>
                        <span className="layer-meta">
                          {typeof u.uploadDate === 'string' ? u.uploadDate.split('T')[0] : '—'}
                          {' · '}
                          {u.geometryCount ?? 0} feature(s)
                          {u.uploadedBy ? ` · ${u.uploadedBy}` : ''}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm layer-kml-btn"
                        onClick={() => downloadFileKml(u)}
                      >
                        Download KML
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="gis-panel-footer">
              <div className="gis-stat">
                <span className="gis-stat-label">Features on map</span>
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
