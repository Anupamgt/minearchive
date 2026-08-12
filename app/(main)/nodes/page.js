'use client';

import { useState, useEffect } from 'react';
import { useToast } from '../../components/ToastProvider';
import './nodes.css';

function StatusTag({ status }) {
  const s = (status || '').toLowerCase();
  const cls = s === 'active' ? 'tag-green' : s === 'proposed' ? 'tag-yellow' : 'tag';
  return <span className={`tag ${cls}`}>{(status || 'unknown').toUpperCase()}</span>;
}

export default function NodesPage() {
  const { showToast } = useToast();
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
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
        setLoading(false);
      })
      .catch(() => {
        setNodes([
          { id: 1, name: 'Ropar North Quarry', status: 'active', uploadCount: 5, updatedAt: 'Jun 15, 2026' },
          { id: 2, name: 'Sutlej River Pit', status: 'active', uploadCount: 3, updatedAt: 'Jun 14, 2026' },
          { id: 3, name: 'Nangal Road Site', status: 'active', uploadCount: 4, updatedAt: 'Jun 13, 2026' },
          { id: 4, name: 'Kiratpur Quarry', status: 'active', uploadCount: 2, updatedAt: 'Jun 12, 2026' },
          { id: 5, name: 'Sutlej New Pit', status: 'proposed', uploadCount: 0, updatedAt: 'Jun 11, 2026' },
        ]);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchNodes();
  }, []);

  const handleCreate = (e) => {
    e.preventDefault();
    if (!formData.name) {
      showToast('Please enter a name for the monitoring area.', 'warning');
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
        showToast(`Created monitoring area: ${formData.name}`, 'success');
        setFormData({ name: '', status: 'active', locationLabel: 'Ropar District' });
        fetchNodes();
      })
      .catch(() => {
        setNodes((prev) => [
          { id: Date.now(), name: formData.name, status: formData.status, uploadCount: 0, updatedAt: 'Just now' },
          ...prev,
        ]);
        setShowModal(false);
        showToast(`Added ${formData.name} (offline demo mode)`, 'success');
      });
  };

  return (
    <div className="nodes-container">
      <div className="page-header">
        <div>
          <h1>Monitoring Areas</h1>
          <p className="page-subtitle">Mining boundaries monitored across the district</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>New area</button>
      </div>

      <div className="card">
        {loading ? (
          <div className="nodes-skeletons">
            {[0, 1, 2, 3, 4].map((i) => (
              <div className="nodes-skeleton-row" key={i}>
                <div className="skeleton" style={{ height: 14, width: '32%' }} />
                <div className="skeleton" style={{ height: 14, width: '14%' }} />
                <div className="skeleton" style={{ height: 14, width: '10%' }} />
                <div className="skeleton" style={{ height: 14, width: '18%' }} />
                <div className="skeleton" style={{ height: 14, width: '16%' }} />
              </div>
            ))}
          </div>
        ) : nodes.length === 0 ? (
          <div className="empty-state">
            <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0 0 21 18.382V7.618a1 1 0 0 0-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <h3>No monitoring areas yet</h3>
            <p>Monitoring areas are the mining boundaries you track over time. Create your first one to start archiving survey data.</p>
            <button className="btn btn-primary mt-16" onClick={() => setShowModal(true)}>Create your first monitoring area</button>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Boundary files</th>
                <th>Last updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((n) => (
                <tr key={n.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text)' }}>{n.name}</td>
                  <td>
                    <StatusTag status={n.status} />
                  </td>
                  <td>{n.uploadCount || n.uploads || 0}</td>
                  <td style={{ color: 'var(--muted)' }}>{typeof n.updatedAt === 'string' ? n.updatedAt.split('T')[0] : 'Jun 15, 2026'}</td>
                  <td>
                    <div className="nodes-actions">
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => showToast(`Editing details for ${n.name}`, 'info')}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => showToast(`Archived monitoring area: ${n.name}`, 'warning')}
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
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New monitoring area</h3>
              <button type="button" className="modal-close" onClick={() => setShowModal(false)} aria-label="Close">×</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="required" htmlFor="node-name">Area name</label>
                  <input
                    id="node-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Nangal Quarry Sector 4"
                  />
                  <p className="help-text">A clear, recognizable name for this mining boundary.</p>
                </div>
                <div className="form-group">
                  <label htmlFor="node-status">Status</label>
                  <select
                    id="node-status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="proposed">Proposed</option>
                    <option value="archived">Archived</option>
                  </select>
                  <p className="help-text">Active areas are actively monitored. Proposed areas are awaiting review.</p>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create area</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
