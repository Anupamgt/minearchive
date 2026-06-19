'use client';

import { useState } from 'react';
import './users.css';

const USERS_DATA = [
  { name: 'Harpreet Singh', email: 'harpreet@mine.co', role: 'User', status: 'Active', lastLogin: 'Jun 15, 2026' },
  { name: 'Amit Sharma', email: 'amit@mine.co', role: 'User', status: 'Active', lastLogin: 'Jun 14, 2026' },
  { name: 'Priya Kaur', email: 'priya@mine.co', role: 'User', status: 'Active', lastLogin: 'Jun 12, 2026' },
  { name: 'Admin', email: 'admin@minearchive.co', role: 'Admin', status: 'Active', lastLogin: 'Jun 15, 2026' },
];

export default function UsersPage() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div>
      <div className="page-header">
        <div className="users-title">User Management</div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
          + Create User
        </button>
      </div>

      <div className="users-table-wrapper">
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
            {USERS_DATA.map((user, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 500 }}>{user.name}</td>
                <td style={{ color: 'var(--muted)', fontSize: 12 }}>{user.email}</td>
                <td>
                  <span className={`tag ${user.role === 'Admin' ? 'tag-accent' : ''}`}>
                    {user.role}
                  </span>
                </td>
                <td>
                  <span className="tag tag-green">{user.status}</span>
                </td>
                <td style={{ color: 'var(--muted)', fontSize: 12 }}>{user.lastLogin}</td>
                <td>
                  <button className="action-link">Edit</button>
                  {user.role !== 'Admin' && (
                    <button className="action-link" style={{ color: 'var(--yellow)', marginLeft: 10 }}>
                      Disable
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create User Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create User</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Full Name</label>
                <input type="text" placeholder="e.g. Rajinder Singh" />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" placeholder="e.g. rajinder@mine.co" />
              </div>
              <div className="form-group">
                <label>Temporary Password</label>
                <input type="password" placeholder="••••••••" />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select>
                  <option value="User">User</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => setShowModal(false)}>Create User</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
