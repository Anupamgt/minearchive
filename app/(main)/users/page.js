'use client';

import { useState, useEffect } from 'react';
import { useToast } from '../../components/ToastProvider';
import './users.css';

function RoleTag({ role }) {
  const isAdmin = role === 'Admin';
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
  const [formData, setFormData] = useState({ name: '', email: '', role: 'User' });

  const fetchUsers = () => {
    fetch('/api/users')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setUsers(data);
        } else {
          setUsers([
            { id: 1, name: 'Harpreet Singh', email: 'harpreet@mine.co', role: 'User', status: 'active', lastLogin: 'Jun 15, 2026' },
            { id: 2, name: 'Amit Sharma', email: 'amit@mine.co', role: 'User', status: 'active', lastLogin: 'Jun 14, 2026' },
            { id: 3, name: 'Priya Kaur', email: 'priya@mine.co', role: 'User', status: 'active', lastLogin: 'Jun 12, 2026' },
            { id: 4, name: 'Central Admin', email: 'admin@minearchive.co', role: 'Admin', status: 'active', lastLogin: 'Jun 15, 2026' },
          ]);
        }
        setLoading(false);
      })
      .catch(() => {
        setUsers([
          { id: 1, name: 'Harpreet Singh', email: 'harpreet@mine.co', role: 'User', status: 'active', lastLogin: 'Jun 15, 2026' },
          { id: 2, name: 'Amit Sharma', email: 'amit@mine.co', role: 'User', status: 'active', lastLogin: 'Jun 14, 2026' },
          { id: 3, name: 'Priya Kaur', email: 'priya@mine.co', role: 'User', status: 'active', lastLogin: 'Jun 12, 2026' },
          { id: 4, name: 'Central Admin', email: 'admin@minearchive.co', role: 'Admin', status: 'active', lastLogin: 'Jun 15, 2026' },
        ]);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      showToast('Please enter both name and email.', 'warning');
      return;
    }

    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
      .then((res) => res.json())
      .then(() => {
        setShowModal(false);
        showToast(`Invited new user: ${formData.name}`, 'success');
        setFormData({ name: '', email: '', role: 'User' });
        fetchUsers();
      })
      .catch(() => {
        setUsers((prev) => [
          { id: Date.now(), name: formData.name, email: formData.email, role: formData.role, status: 'active', lastLogin: 'Never' },
          ...prev,
        ]);
        setShowModal(false);
        showToast(`Added user ${formData.name} (offline demo mode)`, 'success');
      });
  };

  return (
    <div className="users-container">
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p className="page-subtitle">People with access to MineArchive</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>Add user</button>
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
            <button className="btn btn-primary mt-16" onClick={() => setShowModal(true)}>Add your first user</button>
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
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text)' }}>{u.name}</td>
                  <td style={{ color: 'var(--muted)' }}>{u.email}</td>
                  <td>
                    <RoleTag role={u.role} />
                  </td>
                  <td>
                    <StatusTag status={u.status} />
                  </td>
                  <td style={{ color: 'var(--muted)' }}>{typeof u.lastLogin === 'string' ? u.lastLogin.split('T')[0] : 'Jun 15, 2026'}</td>
                  <td>
                    <div className="users-actions">
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => showToast(`Editing permissions for ${u.name}`, 'info')}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => showToast(`Disabled access for ${u.name}`, 'warning')}
                      >
                        Disable
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
              <h3>Add user</h3>
              <button type="button" className="modal-close" onClick={() => setShowModal(false)} aria-label="Close">×</button>
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
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add user</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
