'use client';

import { useState, useEffect } from 'react';
import { useToast } from '../../components/ToastProvider';
import './users.css';

export default function UsersPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [query, setQuery] = useState('');
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
      })
      .catch(() => {
        setUsers([
          { id: 1, name: 'Harpreet Singh', email: 'harpreet@mine.co', role: 'User', status: 'active', lastLogin: 'Jun 15, 2026' },
          { id: 2, name: 'Amit Sharma', email: 'amit@mine.co', role: 'User', status: 'active', lastLogin: 'Jun 14, 2026' },
          { id: 3, name: 'Priya Kaur', email: 'priya@mine.co', role: 'User', status: 'active', lastLogin: 'Jun 12, 2026' },
          { id: 4, name: 'Central Admin', email: 'admin@minearchive.co', role: 'Admin', status: 'active', lastLogin: 'Jun 15, 2026' },
        ]);
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
        showToast(`Authorized new contractor user: ${formData.name}`, 'success');
        setFormData({ name: '', email: '', role: 'User' });
        fetchUsers();
      })
      .catch(() => {
        setUsers((prev) => [
          { id: Date.now(), name: formData.name, email: formData.email, role: formData.role, status: 'active', lastLogin: 'Never' },
          ...prev,
        ]);
        setShowModal(false);
        showToast(`Added user ${formData.name} (Offline demo mode)`, 'success');
      });
  };

  const q = query.trim().toLowerCase();
  const filteredUsers =
    q === ''
      ? users
      : users.filter((u) =>
          [u.name, u.email, u.role, u.status]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q))
        );

  return (
    <div className="users-container">
      <div className="page-header">
        <div>
          <h1>User Management</h1>
          <p className="page-subtitle">Access control for contractors and central officers</p>
        </div>
        <div className="header-actions">
          <input
            type="search"
            className="input"
            placeholder="Search users…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Authorize User</button>
        </div>
      </div>

      <div className="card table-card">
        {filteredUsers.length === 0 ? (
          <div className="empty-state">
            <p>No users match your search.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td style={{ color: 'var(--muted)' }}>{u.email}</td>
                  <td>
                    <span className={`tag ${u.role === 'Admin' ? 'tag-accent' : ''}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <span className={`tag ${(u.status || 'active').toLowerCase() === 'active' ? 'tag-green' : ''}`}>
                      {u.status ? u.status.toUpperCase() : 'ACTIVE'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--muted)' }}>{typeof u.lastLogin === 'string' ? u.lastLogin.split('T')[0] : 'Jun 15, 2026'}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => showToast(`Editing persona privileges for ${u.name}`, 'info')}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => showToast(`Revoked access credentials for ${u.name}`, 'warning')}
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
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Authorize New Contractor / Admin</h3>
              <button type="button" className="modal-close" aria-label="Close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Gurpreet Singh"
                  />
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    className="input"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. gurpreet@mine.co"
                  />
                </div>
                <div className="form-group">
                  <label>Role Permission</label>
                  <select
                    className="input"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="User">User (Field Contractor - Upload Only)</option>
                    <option value="Admin">Admin (Central Officer - Full Control)</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Authorize User</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
