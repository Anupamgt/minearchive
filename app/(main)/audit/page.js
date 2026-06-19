'use client';

import { useState } from 'react';
import './audit.css';

const AUDIT_DATA = [
  { ts: '2026-06-15 14:32', user: 'Harpreet Singh', action: 'Upload KML', node: 'Ropar North Quarry', details: 'Routine Survey #5' },
  { ts: '2026-06-15 10:15', user: 'Admin', action: 'Soft Delete', node: 'Sutlej River Pit', details: 'Removed duplicate upload' },
  { ts: '2026-06-14 09:00', user: 'System', action: 'Area Change', node: 'Nangal Road Site', details: '+8.2% expansion detected' },
  { ts: '2026-06-13 16:45', user: 'Amit Sharma', action: 'Upload KML', node: 'Kiratpur Quarry', details: 'Encroachment report' },
  { ts: '2026-06-13 11:20', user: 'Harpreet Singh', action: 'Login', node: '—', details: 'Successful login' },
  { ts: '2026-06-12 09:30', user: 'Priya Kaur', action: 'Upload KML', node: 'Ropar North Quarry', details: 'Restoration check' },
  { ts: '2026-06-11 14:00', user: 'Admin', action: 'Approve Node', node: 'Sutlej New Pit', details: 'New node approved' },
  { ts: '2026-06-10 08:45', user: 'Amit Sharma', action: 'Upload KML', node: 'Ropar North Quarry', details: 'Boundary update' },
  { ts: '2026-06-09 16:30', user: 'System', action: 'Area Change', node: 'Sutlej River Pit', details: '-2.4% contraction detected' },
  { ts: '2026-06-08 10:00', user: 'Harpreet Singh', action: 'Login', node: '—', details: 'Successful login' },
];

export default function AuditPage() {
  const [dateRange, setDateRange] = useState('30');
  const [userFilter, setUserFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [nodeFilter, setNodeFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = AUDIT_DATA.filter((row) => {
    if (userFilter !== 'all' && row.user !== userFilter) return false;
    if (actionFilter !== 'all' && row.action !== actionFilter) return false;
    if (nodeFilter !== 'all' && row.node !== nodeFilter) return false;
    if (search && !Object.values(row).some((v) => v.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <div className="audit-title">Audit Log</div>
      </div>

      <div className="audit-toolbar">
        <div className="audit-filters">
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
            <option value="all">All Users</option>
            <option value="Harpreet Singh">Harpreet Singh</option>
            <option value="Amit Sharma">Amit Sharma</option>
            <option value="Priya Kaur">Priya Kaur</option>
            <option value="Admin">Admin</option>
            <option value="System">System</option>
          </select>
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            <option value="all">All Actions</option>
            <option value="Upload KML">Upload</option>
            <option value="Soft Delete">Delete</option>
            <option value="Approve Node">Approve</option>
            <option value="Login">Login</option>
            <option value="Area Change">Area Change</option>
          </select>
          <select value={nodeFilter} onChange={(e) => setNodeFilter(e.target.value)}>
            <option value="all">All Nodes</option>
            <option value="Ropar North Quarry">Ropar North Quarry</option>
            <option value="Sutlej River Pit">Sutlej River Pit</option>
            <option value="Nangal Road Site">Nangal Road Site</option>
            <option value="Kiratpur Quarry">Kiratpur Quarry</option>
          </select>
          <input
            type="search"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="audit-exports">
          <button className="btn btn-sm btn-outline">Export PDF</button>
          <button className="btn btn-sm btn-outline">Export CSV</button>
        </div>
      </div>

      <div className="audit-table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Action</th>
              <th>Node</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={i}>
                <td style={{ color: 'var(--muted)', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 12 }}>
                  {row.ts}
                </td>
                <td>{row.user}</td>
                <td>
                  <span className={`tag ${
                    row.action === 'Upload KML' ? 'tag-accent' :
                    row.action === 'Soft Delete' ? 'tag-red' :
                    row.action === 'Approve Node' ? 'tag-green' :
                    row.action === 'Area Change' ? 'tag-yellow' :
                    ''
                  }`}>
                    {row.action}
                  </span>
                </td>
                <td style={{ color: row.node === '—' ? 'var(--muted)' : 'var(--accent2)' }}>
                  {row.node}
                </td>
                <td style={{ color: 'var(--muted)', fontSize: 12 }}>{row.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button>‹</button>
        <button className="active">1</button>
        <button>2</button>
        <button>3</button>
        <button>›</button>
      </div>
    </div>
  );
}
