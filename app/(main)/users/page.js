'use client';

import { useState, useEffect } from 'react';
import { useToast } from '../../components/ToastProvider';
import { readSessionFromCookie } from '../../../lib/session-client';
import './users.css';

function RoleTag({ role }) {
  const isAdmin = (role || '').toLowerCase() === 'admin';
  return <span className={`tag ${isAdmin ? 'tag-accent' : ''}`}>{role || 'User'}</span>;
}

function StatusTag({ status }) {
  const s = (status || 'active').toLowerCase();
  const cls = s === 'active' ? 'tag-green' : s === 'pending' ? 'tag-yellow' : 'tag';
  return <span className={`tag ${cls}`}>{(status || 'active').toUpperCase()}</span>;
}

export default function UsersPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [sessionUser, setSessionUser] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'User' });

  useEffect(() => {
    setSessionUser(readSessionFromCookie());
  }, []);

  const fetchUsers = () => {
    fetch('/api/users', { credentials: 'same-origin' })
      .then((res) => res.json())
      .then((data) => {
        setUsers(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setUsers([]);
        setLoading(false);
        showToast('Could not load users.', 'error');
      });
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      showToast('Please enter both name and email.', 'warning');
      return;
    }
    if (!formData.password) {
      showToast('Please set a temporary password for this user.', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(formData),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not add user');

      setShowModal(false);
      showToast(`Added user: ${formData.name}`, 'success');
      setFormData({ name: '', email: '', password: '', role: 'User' });
      fetchUsers();
    } catch (err) {
      showToast(err.message || 'Could not add user', 'error');
    }
  };

  const patchUser = async (user, patch, successMessage) => {
    setBusyId(user.id);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(user.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Update failed');

      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...data } : u)));
      showToast(successMessage, 'success');
      return true;
    } catch (err) {
      showToast(err.message || 'Update failed', 'error');
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleAccess = (user) => {
    const isActive = (user.status || 'active').toLowerCase() === 'active';
    if (isActive && !window.confirm(`Disable access for ${user.name}?`)) return;

    patchUser(
      user,
      { status: isActive ? 'disabled' : 'active' },
      isActive ? `Disabled access for ${user.name}` : `Re-enabled access for ${user.name}`
    );
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editing) return;
    const ok = await patchUser(
      editing,
      { name: editing.name, role: editing.role },
      `Updated ${editing.name}`
    );
    if (ok) setEditing(null);
  };

  return (
    <div className="users-container">
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p className="page-subtitle">People with access to MineArchive</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          Add user
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="users-skeletons">
            {[0, 1, 2, 3].map((i) => (
              <div className="users-skeleton-row" key={i}>
                <div className="skeleton" style={{ height: 14, width: '22%' }} />
                <div className="skeleton" style={{ height: 14, width: '26%' }} />
                <div className="skeleton" style={{ height: 14, width: '10%' }} />
                <div className="skeleton" style={{ height: 14, width: '12%' }} />
                <div className="skeleton" style={{ height: 14, width: '16%' }} />
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <h3>No users yet</h3>
            <p>Add the people who need to view areas, upload boundary files, or manage the archive.</p>
            <button className="btn btn-primary mt-16" onClick={() => setShowModal(true)}>
              Add your first user
            </button>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isActive = (u.status || 'active').toLowerCase() === 'active';
                const isBusy = busyId === u.id;
                const isSelf = sessionUser?.id === u.id;
                return (
                  <tr key={u.id} style={isActive ? undefined : { opacity: 0.72 }}>
                    <td style={{ fontWeight: 600, color: 'var(--text)' }}>
                      {u.name}
                      {isSelf && <span className="tag" style={{ marginLeft: 8 }}>You</span>}
                    </td>
                    <td style={{ color: 'var(--muted)' }}>{u.email}</td>
                    <td>
                      <RoleTag role={u.role} />
                    </td>
                    <td>
                      <StatusTag status={u.status} />
                    </td>
                    <td style={{ color: 'var(--muted)' }}>
                      {u.lastLogin ? String(u.lastLogin).split('T')[0] : 'Never'}
                    </td>
                    <td>
                      <div className="users-actions">
                        <button
                          className="btn btn-outline btn-sm"
                          disabled={isBusy}
                          onClick={() => setEditing({ id: u.id, name: u.name, role: u.role || 'User' })}
                        >
                          Edit
                        </button>
                        <button
                          className={`btn btn-sm ${isActive ? 'btn-danger' : 'btn-outline'}`}
                          disabled={isBusy || isSelf}
                          title={isSelf ? 'You cannot disable your own account' : undefined}
                          onClick={() => handleToggleAccess(u)}
                        >
                          {isBusy ? 'Working…' : isActive ? 'Disable' : 'Enable'}
                        </button>
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
              <h3>Add user</h3>
              <button type="button" className="modal-close" onClick={() => setShowModal(false)} aria-label="Close">
                ×
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="required" htmlFor="user-name">Full name</label>
                  <input
                    id="user-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Gurpreet Singh"
                  />
                </div>
                <div className="form-group">
                  <label className="required" htmlFor="user-email">Email address</label>
                  <input
                    id="user-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. gurpreet@mine.co"
                  />
                  <p className="help-text">Used to sign in and receive access notifications.</p>
                </div>
                <div className="form-group">
                  <label className="required" htmlFor="user-password">Temporary password</label>
                  <input
                    id="user-password"
                    type="text"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Share this with the user"
                  />
                  <p className="help-text">They can sign in with this, or use Google sign-in instead.</p>
                </div>
                <div className="form-group">
                  <label htmlFor="user-role">Role</label>
                  <select
                    id="user-role"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="User">User — can upload boundary files</option>
                    <option value="Admin">Admin — full access and management</option>
                  </select>
                  <p className="help-text">Admins can manage users and monitoring areas. Users can upload and view.</p>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add user
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
              <h3>Edit user</h3>
              <button type="button" className="modal-close" onClick={() => setEditing(null)} aria-label="Close">
                ×
              </button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="required" htmlFor="edit-user-name">Full name</label>
                  <input
                    id="edit-user-name"
                    type="text"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-user-role">Role</label>
                  <select
                    id="edit-user-role"
                    value={editing.role}
                    onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                  >
                    <option value="User">User — can upload boundary files</option>
                    <option value="Admin">Admin — full access and management</option>
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
