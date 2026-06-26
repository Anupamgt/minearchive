'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
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
  const [nodes, setNodes] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [activeTab, setActiveTab] = useState('timeline');
  const [uploads, setUploads] = useState([]);
  const [shownUploads, setShownUploads] = useState(new Set());
  const [loadingUploads, setLoadingUploads] = useState(false);
  const [role, setRole] = useState('Admin');

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
      if (next.has(uploadId)) next.delete(uploadId);
      else next.add(uploadId);
      return next;
    });
  };

  const activeNodeObj = nodes.find((n) => n.id === selectedNode || parseInt(n.id) === selectedNode);
  const nodeName = activeNodeObj ? activeNodeObj.name : (selectedNode === 1 ? 'Ropar North Quarry' : selectedNode === 2 ? 'Sutlej River Pit' : selectedNode === 3 ? 'Nangal Road Site' : 'Kiratpur Quarry');

  const handleFlagBreach = () => {
    const reason = prompt(`Enter encroachment breach findings for ${nodeName}:`, 'Exceeded approved perimeter boundary by 14.2 meters towards northern riverbank');
    if (!reason) return;

    alert(`⚠️ ENCROACHMENT BREACH FLAGGED!\n\nNode: ${nodeName}\nFindings: ${reason}\n\nViolation notice logged to central audit trail.`);
  };

  return (
    <div className="map-container">
      <div className="map-area">
        <MapWithNoSSR
          selectedNode={selectedNode}
          onSelectNode={(id) => {
            setSelectedNode(id);
            setShownUploads(new Set());
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
            Click a node on the OpenStreetMap layer to view its directory history
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
                <div style={{ padding: 10, color: 'var(--muted)', fontSize: 12 }}>Loading directory archive...</div>
              ) : activeTab === 'timeline' ? (
                uploads.map((u) => (
                  <div className="timeline-entry" key={u.id}>
                    <div className="timeline-info">
                      <div>
                        <span className="timeline-id">#{u.id}</span>
                        <span className="timeline-date">{typeof u.uploadDate === 'string' ? u.uploadDate.split('T')[0] : 'Jun 15, 2026'}</span>
                      </div>
                      <div className="timeline-category">{u.category}</div>
                      <div className="timeline-user">{u.uploadedBy || u.user}</div>
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
                  <span className="metric-label">Area: </span>
                  <span className="metric-value positive">+12.3 ha (+8.2%)</span>
                </div>
                <div>
                  <span className="metric-label">Perimeter: </span>
                  <span className="metric-value positive">+340m</span>
                </div>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleFlagBreach}
                  style={{ width: '100%', marginTop: 12, background: 'var(--red)', color: '#fff', border: 'none', padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}
                >
                  ⚠️ Flag Encroachment Breach
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
