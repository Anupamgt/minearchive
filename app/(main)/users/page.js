'use client';

import { useState, useEffect } from 'react';
import './users.css';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'user' });

  const fetchUsers = () => {
    fetch('/api/users')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setUsers(data);
        } else {
          setUsers([
            { id: '1', name: 'Harpreet Singh', email: 'harpreet@mine.co', role: 'User', status: 'Active', lastLogin: 'Jun 15, 2026' },
            { id: '2', name: 'Amit Sharma', email: 'amit@mine.co', role: 'User', status: 'Active', lastLogin: 'Jun 14, 2026' },
            { id: '3', name: 'Priya Kaur', email: 'priya@mine.co', role: 'User', status: 'Active', lastLogin: 'Jun 12, 2026' },
            { id: '4', name: 'Admin', email: 'admin@minearchive.co', role: 'Admin', status: 'Active', lastLogin: 'Jun 15, 2026' },
          ]);
        }
      })
      .catch(() => {
        setUsers([
          { id: '1', name: 'Harpreet Singh', email: 'harpreet@mine.co', role: 'User', status: 'Active', lastLogin: 'Jun 15, 2026' },
          { id: '2', name: 'Amit Sharma', email: 'amit@mine.co', role: 'User', status: 'Active', lastLogin: 'Jun 14, 2026' },
          { id: '3', name: 'Priya Kaur', email: 'priya@mine.co', role: 'User', status: 'Active', lastLogin: 'Jun 12, 2026' },
          { id: '4', name: 'Admin', email: 'admin@minearchive.co', role: 'Admin', status: 'Active', lastLogin: 'Jun 15, 2026' },
        ]);
      });
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password) return;

    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
      .then((res) => res.json())
      .then(() => {
        setShowModal(false);
        setFormData({ name: '', email: '', password: '', role: 'user' });
        fetchUsers();
      })
      .catch(() => {
        setUsers((prev) => [
          { id: Date.now().toString(), name: formData.name, email: formData.email, role: formData.role, status: 'Active', lastLogin: 'Never' },
          ...prev,
        ]);
        setShowModal(false);
      });
  };

  return (
    <div className="users-container">
      <div className="users-header">
        <div className="users-title">USER MANAGEMENT (CENTRAL ADMINISTRATOR & USERS)</div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Create User</button>
      </div>

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
          {users.map((u) => (
            <tr key={u.id}>
              <td style={{ fontWeight: 600 }}>{u.name}</td>
              <td style={{ color: 'var(--muted)' }}>{u.email}</td>
              <td>
                <span style={{ color: u.role && u.role.toLowerCase() === 'admin' ? 'var(--accent)' : 'var(--text)' }}>
                  {u.role}
                </span>
              </td>
              <td>
                <span className="tag tag-green">{u.status || 'Active'}</span>
              </td>
              <td style={{ color: 'var(--muted)' }}>{typeof u.lastLogin === 'string' ? u.lastLogin.split('T')[0] : 'Jun 15, 2026'}</td>
              <td>
                <button className="btn btn-outline" style={{ padding: '2px 8px', fontSize: 11, marginRight: 6 }}>Edit</button>
                <button className="btn btn-outline" style={{ padding: '2px 8px', fontSize: 11 }}>Disable</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: 20, width: 400 }}>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>Provision New User Persona</h3>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Full Name</label>
                <input
                  type="text"
                  className="input"
                  style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', color: '#fff', padding: 8 }}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Jaswinder Gill"
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Email Address</label>
                <input
                  type="email"
                  className="input"
                  style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', color: '#fff', padding: 8 }}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. jaswinder@mine.co"
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Temporary Password</label>
                <input
                  type="password"
                  className="input"
                  style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', color: '#fff', padding: 8 }}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Persona Role</label>
                <select
                  className="input"
                  style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', color: '#fff', padding: 8 }}
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="user">User (Upload KML & Monitor Nodes)</option>
                  <option value="admin">Central Administrator (Full System Access)</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
