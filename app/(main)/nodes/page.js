'use client';

import { useState, useEffect } from 'react';
import { useToast } from '../../components/ToastProvider';
import './nodes.css';

export default function NodesPage() {
  const { showToast } = useToast();
  const [nodes, setNodes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [query, setQuery] = useState('');
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
    if (!formData.name) {
      showToast('Please enter an enclosure name.', 'warning');
      return;
    }

    fetch('/api/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
      .then((res) => res.json())
      .then(() => {
        setShowModal(false);
        showToast(`Created mining node enclosure: ${formData.name}`, 'success');
        setFormData({ name: '', status: 'active', locationLabel: 'Ropar District' });
        fetchNodes();
      })
      .catch(() => {
        setNodes((prev) => [
          { id: Date.now(), name: formData.name, status: formData.status, uploadCount: 0, updatedAt: 'Just now' },
          ...prev,
        ]);
        setShowModal(false);
        showToast(`Added ${formData.name} (Offline demo mode)`, 'success');
      });
  };

  const q = query.trim().toLowerCase();
  const filteredNodes =
    q === ''
      ? nodes
      : nodes.filter((n) =>
          [n.name, n.status, n.locationLabel, n.description]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q))
        );

  const statusTagClass = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'active') return 'tag tag-green';
    if (s === 'proposed' || s === 'pending') return 'tag tag-yellow';
    return 'tag';
  };

  return (
    <div className="nodes-container">
      <div className="page-header">
        <div>
          <h1>Node Management</h1>
          <p className="page-subtitle">Mining enclosures across Ropar District</p>
        </div>
        <div className="header-actions">
          <input
            type="search"
            className="input"
            placeholder="Search nodes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Create Node</button>
        </div>
      </div>

      <div className="card table-card">
        {filteredNodes.length === 0 ? (
          <div className="empty-state">
            <p>No nodes match your search.</p>
          </div>
        ) : (
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
              {filteredNodes.map((n) => (
                <tr key={n.id}>
                  <td style={{ fontWeight: 600 }}>{n.name}</td>
                  <td>
                    <span className={statusTagClass(n.status)}>
                      {(n.status || '').toUpperCase()}
                    </span>
                  </td>
                  <td>{n.uploadCount || n.uploads || 0}</td>
                  <td style={{ color: 'var(--muted)' }}>{typeof n.updatedAt === 'string' ? n.updatedAt.split('T')[0] : 'Jun 15, 2026'}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => showToast(`Editing parameters for ${n.name}`, 'info')}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => showToast(`Archived enclosure node #${n.id}`, 'warning')}
                      >
                        Archive
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Create Mining Node Enclosure</h3>
              <button type="button" className="modal-close" aria-label="Close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Enclosure Name</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Nangal Quarry Sector 4"
                  />
                </div>
                <div className="form-group">
                  <label>Initial Status</label>
                  <select
                    className="input"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="proposed">Proposed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
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
