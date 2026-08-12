'use client';

import { useState, useEffect } from 'react';
import { useToast } from '../../components/ToastProvider';
import './nodes.css';

function StatusTag({ status }) {
  const s = (status || '').toLowerCase();
  const cls =
    s === 'active' ? 'tag-green' : s === 'proposed' ? 'tag-yellow' : s === 'archived' ? 'tag' : 'tag';
  return <span className={`tag ${cls}`}>{(status || 'unknown').toUpperCase()}</span>;
}

export default function NodesPage() {
  const { showToast } = useToast();
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [formData, setFormData] = useState({ name: '', status: 'active', locationLabel: 'Ropar District' });

  const fetchNodes = () => {
    fetch('/api/nodes', { credentials: 'same-origin' })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setNodes(data);
        } else {
          setNodes([]);
        }
        setLoading(false);
      })
      .catch(() => {
        setNodes([]);
        setLoading(false);
        showToast('Could not load monitoring areas.', 'error');
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
      credentials: 'same-origin',
      body: JSON.stringify(formData),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Create failed');
        setShowModal(false);
        showToast(`Created monitoring area: ${formData.name}`, 'success');
        setFormData({ name: '', status: 'active', locationLabel: 'Ropar District' });
        fetchNodes();
      })
      .catch((err) => {
        showToast(err.message || 'Failed to create monitoring area', 'error');
      });
  };

  const patchNode = async (node, patch, successMessage, tone = 'success') => {
    setBusyId(node.id);
    try {
      const res = await fetch(`/api/nodes/${encodeURIComponent(node.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Update failed');
      }

      setNodes((prev) => prev.map((n) => (n.id === node.id ? { ...n, ...data } : n)));
      showToast(successMessage, tone);
      return true;
    } catch (err) {
      showToast(err.message || 'Could not update monitoring area', 'error');
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const updateNodeStatus = (node, nextStatus) => {
    const message =
      nextStatus === 'archived'
        ? `Archived monitoring area: ${node.name}`
        : nextStatus === 'active'
          ? `Restored monitoring area: ${node.name}`
          : `Updated ${node.name} → ${nextStatus}`;
    return patchNode(node, { status: nextStatus }, message, nextStatus === 'archived' ? 'warning' : 'success');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editing) return;
    if (!editing.name.trim()) {
      showToast('Area name cannot be empty.', 'warning');
      return;
    }
    const ok = await patchNode(
      editing,
      { name: editing.name.trim(), status: editing.status },
      `Updated ${editing.name.trim()}`
    );
    if (ok) setEditing(null);
  };

  const handleArchive = (node) => {
    const ok = window.confirm(
      `Archive “${node.name}”? It will be marked archived and stay in the list for history.`
    );
    if (!ok) return;
    updateNodeStatus(node, 'archived');
  };

  const handleRestore = (node) => {
    updateNodeStatus(node, 'active');
  };

  return (
    <div className="nodes-container">
      <div className="page-header">
        <div>
          <h1>Monitoring Areas</h1>
          <p className="page-subtitle">Mining boundaries monitored across the district</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          New area
        </button>
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
            <svg
              width="46"
              height="46"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0 0 21 18.382V7.618a1 1 0 0 0-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <h3>No monitoring areas yet</h3>
            <p>
              Monitoring areas are the mining boundaries you track over time. Create your first one
              to start archiving survey data.
            </p>
            <button className="btn btn-primary mt-16" onClick={() => setShowModal(true)}>
              Create your first monitoring area
            </button>
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
              {nodes.map((n) => {
                const isArchived = (n.status || '').toLowerCase() === 'archived';
                const isBusy = busyId === n.id;
                return (
                  <tr key={n.id} style={isArchived ? { opacity: 0.72 } : undefined}>
                    <td style={{ fontWeight: 600, color: 'var(--text)' }}>{n.name}</td>
                    <td>
                      <StatusTag status={n.status} />
                    </td>
                    <td>{n.uploadCount || n.uploads || 0}</td>
                    <td style={{ color: 'var(--muted)' }}>
                      {typeof n.updatedAt === 'string'
                        ? n.updatedAt.split('T')[0]
                        : '—'}
                    </td>
                    <td>
                      <div className="nodes-actions">
                        <button
                          className="btn btn-outline btn-sm"
                          disabled={isBusy}
                          onClick={() =>
                            setEditing({
                              id: n.id,
                              name: n.name,
                              status: (n.status || 'active').toLowerCase(),
                            })
                          }
                        >
                          Edit
                        </button>
                        {isArchived ? (
                          <button
                            className="btn btn-outline btn-sm"
                            disabled={isBusy}
                            onClick={() => handleRestore(n)}
                          >
                            {isBusy ? 'Working…' : 'Restore'}
                          </button>
                        ) : (
                          <button
                            className="btn btn-danger btn-sm"
                            disabled={isBusy}
                            onClick={() => handleArchive(n)}
                          >
                            {isBusy ? 'Working…' : 'Archive'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New monitoring area</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowModal(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="required" htmlFor="node-name">
                    Area name
                  </label>
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
                  <p className="help-text">
                    Active areas are monitored. Proposed await review. Archived stay for history.
                  </p>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create area
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit monitoring area</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setEditing(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="required" htmlFor="edit-node-name">
                    Area name
                  </label>
                  <input
                    id="edit-node-name"
                    type="text"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-node-status">Status</label>
                  <select
                    id="edit-node-status"
                    value={editing.status}
                    onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="proposed">Proposed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={busyId === editing.id}>
                  {busyId === editing.id ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
