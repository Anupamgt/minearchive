'use client';

import { useState, useEffect } from 'react';
import './nodes.css';

export default function NodesPage() {
  const [nodes, setNodes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', status: 'active', locationLabel: 'Ropar District' });

  const fetchNodes = () => {
    fetch('/api/nodes')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setNodes(data);
        } else {
          setNodes([
            { id: 1, name: 'Ropar North Quarry', status: 'active', uploadCount: 5, updatedAt: 'Jun 15, 2026' },
            { id: 2, name: 'Sutlej River Pit', status: 'active', uploadCount: 3, updatedAt: 'Jun 14, 2026' },
            { id: 3, name: 'Nangal Road Site', status: 'active', uploadCount: 4, updatedAt: 'Jun 13, 2026' },
            { id: 4, name: 'Kiratpur Quarry', status: 'active', uploadCount: 2, updatedAt: 'Jun 12, 2026' },
            { id: 5, name: 'Sutlej New Pit', status: 'proposed', uploadCount: 0, updatedAt: 'Jun 11, 2026' },
          ]);
        }
      })
      .catch(() => {
        setNodes([
          { id: 1, name: 'Ropar North Quarry', status: 'active', uploadCount: 5, updatedAt: 'Jun 15, 2026' },
          { id: 2, name: 'Sutlej River Pit', status: 'active', uploadCount: 3, updatedAt: 'Jun 14, 2026' },
          { id: 3, name: 'Nangal Road Site', status: 'active', uploadCount: 4, updatedAt: 'Jun 13, 2026' },
          { id: 4, name: 'Kiratpur Quarry', status: 'active', uploadCount: 2, updatedAt: 'Jun 12, 2026' },
          { id: 5, name: 'Sutlej New Pit', status: 'proposed', uploadCount: 0, updatedAt: 'Jun 11, 2026' },
        ]);
      });
  };

  useEffect(() => {
    fetchNodes();
  }, []);

  const handleCreate = (e) => {
    e.preventDefault();
    if (!formData.name) return;

    fetch('/api/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
      .then((res) => res.json())
      .then(() => {
        setShowModal(false);
        setFormData({ name: '', status: 'active', locationLabel: 'Ropar District' });
        fetchNodes();
      })
      .catch(() => {
        // Optimistic UI fallback
        setNodes((prev) => [
          { id: Date.now(), name: formData.name, status: formData.status, uploadCount: 0, updatedAt: 'Just now' },
          ...prev,
        ]);
        setShowModal(false);
      });
  };

  return (
    <div className="nodes-container">
      <div className="nodes-header">
        <div className="nodes-title">NODE MANAGEMENT (MINING ENCLOSURES)</div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Create Node</button>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Uploads</th>
            <th>Last Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((n) => (
            <tr key={n.id}>
              <td style={{ fontWeight: 600 }}>{n.name}</td>
              <td>
                <span className={`tag ${n.status === 'active' ? 'tag-green' : n.status === 'proposed' ? 'tag-yellow' : ''}`}>
                  {n.status.toUpperCase()}
                </span>
              </td>
              <td>{n.uploadCount || n.uploads || 0}</td>
              <td style={{ color: 'var(--muted)' }}>{typeof n.updatedAt === 'string' ? n.updatedAt.split('T')[0] : 'Jun 15, 2026'}</td>
              <td>
                <button className="btn btn-outline" style={{ padding: '2px 8px', fontSize: 11, marginRight: 6 }}>Edit</button>
                <button className="btn btn-outline" style={{ padding: '2px 8px', fontSize: 11 }}>Archive</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: 20, width: 400 }}>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>Create Mining Node Enclosure</h3>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Enclosure Name</label>
                <input
                  type="text"
                  className="input"
                  style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', color: '#fff', padding: 8 }}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Nangal Quarry Sector 4"
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Initial Status</label>
                <select
                  className="input"
                  style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', color: '#fff', padding: 8 }}
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="proposed">Proposed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Node</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
