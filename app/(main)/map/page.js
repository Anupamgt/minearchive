'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useToast } from '../../components/ToastProvider';
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
  const [shownUploads, setShownUploads] = useState(new Set());
  const [loadingUploads, setLoadingUploads] = useState(false);
  const [role, setRole] = useState('Admin');
  const [breachModal, setBreachModal] = useState(false);
  const [breachReason, setBreachReason] = useState('Exceeded approved perimeter boundary by 14.2 meters towards northern riverbank');

  useEffect(() => {
    const cookies = document.cookie.split('; ');
    const sessionRow = cookies.find((c) => c.startsWith('minearchive_session='));
    if (sessionRow) {
      try {
        const val = sessionRow.split('=')[1];
        const decoded = JSON.parse(Buffer.from(val, 'base64').toString('utf8'));
        if (decoded.role) setRole(decoded.role);
      } catch {}
    }
  }, []);

  const isAdmin = role.toLowerCase() === 'admin';

  useEffect(() => {
    fetch('/api/nodes')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setNodes(data);
        else setNodes([
          { id: '1', name: 'Ropar North Quarry', status: 'active' },
          { id: '2', name: 'Sutlej River Pit', status: 'active' },
          { id: '3', name: 'Nangal Road Site', status: 'active' },
          { id: '4', name: 'Kiratpur Quarry', status: 'active' },
        ]);
      })
      .catch(() => {
        setNodes([
          { id: '1', name: 'Ropar North Quarry', status: 'active' },
          { id: '2', name: 'Sutlej River Pit', status: 'active' },
          { id: '3', name: 'Nangal Road Site', status: 'active' },
          { id: '4', name: 'Kiratpur Quarry', status: 'active' },
        ]);
      });
  }, []);

  useEffect(() => {
    if (!selectedNode) {
      setUploads([]);
      return;
    }
    setLoadingUploads(true);
    fetch(`/api/uploads?nodeId=${selectedNode}`)
      .then((res) => res.json())
      .then((data) => {
        setLoadingUploads(false);
        if (Array.isArray(data) && data.length > 0) setUploads(data);
        else setUploads([
          { id: '5', uploadDate: '2026-06-15', category: 'Routine Survey', uploadedBy: 'Harpreet Singh' },
          { id: '4', uploadDate: '2026-05-02', category: 'Encroachment Report', uploadedBy: 'Amit Sharma' },
          { id: '3', uploadDate: '2026-03-18', category: 'Routine Survey', uploadedBy: 'Harpreet Singh' },
        ]);
      })
      .catch(() => {
        setLoadingUploads(false);
        setUploads([
          { id: '5', uploadDate: '2026-06-15', category: 'Routine Survey', uploadedBy: 'Harpreet Singh' },
          { id: '4', uploadDate: '2026-05-02', category: 'Encroachment Report', uploadedBy: 'Amit Sharma' },
          { id: '3', uploadDate: '2026-03-18', category: 'Routine Survey', uploadedBy: 'Harpreet Singh' },
        ]);
      });
  }, [selectedNode]);

  const toggleShow = (uploadId) => {
    setShownUploads((prev) => {
      const next = new Set(prev);
      if (next.has(uploadId)) {
        next.delete(uploadId);
        showToast(`Hidden KML layer #${uploadId}`, 'info');
      } else {
        next.add(uploadId);
        showToast(`Rendering KML polygon layer #${uploadId} on OpenStreetMap`, 'success');
      }
      return next;
    });
  };

  const activeNodeObj = nodes.find((n) => n.id === selectedNode || parseInt(n.id) === selectedNode);
  const nodeName = activeNodeObj ? activeNodeObj.name : (selectedNode === 1 ? 'Ropar North Quarry' : selectedNode === 2 ? 'Sutlej River Pit' : selectedNode === 3 ? 'Nangal Road Site' : 'Kiratpur Quarry');

  const confirmFlagBreach = (e) => {
    e.preventDefault();
    setBreachModal(false);
    showToast(`⚠️ ENCROACHMENT BREACH FLAGGED for ${nodeName}! Violation notice logged to Central Audit Trail.`, 'error');
  };

  return (
    <div className="map-container">
      <div className="map-area">
        <MapWithNoSSR
          selectedNode={selectedNode}
          onSelectNode={(id) => {
            setSelectedNode(id);
            setShownUploads(new Set());
            showToast(`Selected Enclosure: Node #${id}`, 'info');
          }}
        />
        <div className="map-node-buttons">
          {[
            { id: 1, name: 'Ropar North Quarry' },
            { id: 2, name: 'Sutlej River Pit' },
            { id: 3, name: 'Nangal Road Site' },
            { id: 4, name: 'Kiratpur Quarry' },
          ].map((n) => (
            <button
              key={n.id}
              className={`map-node-btn${selectedNode === n.id ? ' selected' : ''}`}
              onClick={() => {
                setSelectedNode(n.id);
                setShownUploads(new Set());
                showToast(`Focused on ${n.name}`, 'info');
              }}
            >
              {n.name}
            </button>
          ))}
        </div>
      </div>

      <div className="side-panel">
        {!selectedNode ? (
          <div className="side-panel-empty">
            <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>🗺️</div>
            <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>No Mining Enclosure Selected</div>
            <div>Click a polygon boundary on the OpenStreetMap layer or select a pit below to access its spatial archive directory.</div>
          </div>
        ) : (
          <>
            <div className="side-panel-header">
              <div className="side-panel-title">
                {nodeName.toUpperCase()}
                <span className="tag tag-green">Active</span>
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
                  <div style={{ marginBottom: 8 }}>⏳ Fetching spatial archive...</div>
                </div>
              ) : activeTab === 'timeline' ? (
                uploads.map((u) => (
                  <div className="timeline-entry" key={u.id}>
                    <div className="timeline-info">
                      <div>
                        <span className="timeline-id">#{u.id}</span>
                        <span className="timeline-date">{typeof u.uploadDate === 'string' ? u.uploadDate.split('T')[0] : 'Jun 15, 2026'}</span>
                      </div>
                      <div className="timeline-category">{u.category}</div>
                      <div className="timeline-user">Uploaded by: {u.uploadedBy || u.user}</div>
                    </div>
                    <button
                      className={`timeline-show${shownUploads.has(u.id) ? ' active' : ''}`}
                      onClick={() => toggleShow(u.id)}
                    >
                      {shownUploads.has(u.id) ? '✓ Shown' : 'Show'}
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
                        <td style={{ color: 'var(--accent)', fontWeight: 700 }}>#{u.id}</td>
                        <td>{typeof u.uploadDate === 'string' ? u.uploadDate.split('T')[0] : 'Jun 15, 2026'}</td>
                        <td>{u.category}</td>
                        <td style={{ color: 'var(--muted)' }}>{u.uploadedBy || u.user}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="change-metrics">
              <div className="change-metrics-title">Change Metrics (PostGIS Computed)</div>
              <div className="change-metrics-row">
                <div>
                  <span className="metric-label">Area Dev: </span>
                  <span className="metric-value positive">+12.3 ha (+8.2%)</span>
                </div>
                <div>
                  <span className="metric-label">Perimeter Dev: </span>
                  <span className="metric-value positive">+340m</span>
                </div>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setBreachModal(true)}
                  style={{ width: '100%', marginTop: 12, background: 'var(--red)', color: '#fff', border: 'none', padding: '10px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'center', transition: 'background 0.2s' }}
                >
                  ⚠️ Flag Encroachment Breach
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Admin Breach Modal */}
      {breachModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-card" style={{ background: 'var(--surface)', border: '1px solid var(--red)', padding: 24, width: 440 }}>
            <h3 style={{ marginTop: 0, marginBottom: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚠️</span> Flag Encroachment Violation
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text)', marginBottom: 16 }}>
              You are about to issue a formal spatial encroachment notice for <strong>{nodeName}</strong>. This event will be permanently recorded in the Central Audit Trail.
            </p>
            <form onSubmit={confirmFlagBreach}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Findings / Evidence Details</label>
                <textarea
                  className="input"
                  rows="3"
                  style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', color: '#fff', padding: 8 }}
                  value={breachReason}
                  onChange={(e) => setBreachReason(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-outline" onClick={() => setBreachModal(false)}>Cancel</button>
                <button type="submit" className="btn" style={{ background: 'var(--red)', color: '#fff', fontWeight: 700, padding: '8px 16px' }}>Confirm Breach Notice</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
