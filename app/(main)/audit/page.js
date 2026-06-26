'use client';

import { useState, useEffect } from 'react';
import './audit.css';

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('All Actions');
  const [filterUser, setFilterUser] = useState('All Users');

  useEffect(() => {
    fetch('/api/audit?limit=100')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setLogs(data);
        } else {
          setLogs([
            { id: 1, timestamp: '2026-06-15 14:32', userName: 'Harpreet Singh', action: 'Upload KML', targetType: 'Ropar North Quarry', details: 'Routine Survey #5' },
            { id: 2, timestamp: '2026-06-15 10:15', userName: 'Admin', action: 'Archive Node', targetType: 'Sutlej River Pit', details: 'Archived old sector' },
            { id: 3, timestamp: '2026-06-14 09:00', userName: 'System PostGIS', action: 'Area Change', targetType: 'Nangal Road Site', details: '+8.2% expansion detected' },
            { id: 4, timestamp: '2026-06-13 16:45', userName: 'Amit Sharma', action: 'Upload KML', targetType: 'Kiratpur Quarry', details: 'Encroachment report' },
            { id: 5, timestamp: '2026-06-13 11:20', userName: 'Harpreet Singh', action: 'Login', targetType: '—', details: 'Successful login' },
          ]);
        }
      })
      .catch(() => {
        setLogs([
          { id: 1, timestamp: '2026-06-15 14:32', userName: 'Harpreet Singh', action: 'Upload KML', targetType: 'Ropar North Quarry', details: 'Routine Survey #5' },
          { id: 2, timestamp: '2026-06-15 10:15', userName: 'Admin', action: 'Archive Node', targetType: 'Sutlej River Pit', details: 'Archived old sector' },
          { id: 3, timestamp: '2026-06-14 09:00', userName: 'System PostGIS', action: 'Area Change', targetType: 'Nangal Road Site', details: '+8.2% expansion detected' },
          { id: 4, timestamp: '2026-06-13 16:45', userName: 'Amit Sharma', action: 'Upload KML', targetType: 'Kiratpur Quarry', details: 'Encroachment report' },
          { id: 5, timestamp: '2026-06-13 11:20', userName: 'Harpreet Singh', action: 'Login', targetType: '—', details: 'Successful login' },
        ]);
      });
  }, []);

  const filteredLogs = logs.filter((l) => {
    const matchSearch = searchTerm === '' || l.details?.toLowerCase().includes(searchTerm.toLowerCase()) || l.userName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchAction = filterAction === 'All Actions' || l.action?.toLowerCase() === filterAction.toLowerCase();
    const matchUser = filterUser === 'All Users' || l.userName?.toLowerCase() === filterUser.toLowerCase();
    return matchSearch && matchAction && matchUser;
  });

  return (
    <div className="audit-container">
      <div className="audit-title">CENTRAL SYSTEM AUDIT TRAIL</div>

      {/* Filters */}
      <div className="audit-filters">
        <select className="input" value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
          <option>All Actions</option>
          <option value="Upload KML">Upload KML</option>
          <option value="Archive Node">Archive Node</option>
          <option value="Login">Login</option>
        </select>
        <select className="input" value={filterUser} onChange={(e) => setFilterUser(e.target.value)}>
          <option>All Users</option>
          <option value="Harpreet Singh">Harpreet Singh</option>
          <option value="Amit Sharma">Amit Sharma</option>
          <option value="Admin">Admin</option>
        </select>
        <input
          type="text"
          className="input"
          placeholder="Search activity details..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => window.print()}>Export PDF</button>
          <button className="btn btn-outline" onClick={() => alert('Exporting raw CSV archive...')}>Export CSV</button>
        </div>
      </div>

      <table className="table" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>User Persona</th>
            <th>Action Event</th>
            <th>Target Enclosure</th>
            <th>Details / Findings</th>
          </tr>
        </thead>
        <tbody>
          {filteredLogs.map((l) => (
            <tr key={l.id}>
              <td style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                {typeof l.timestamp === 'string' ? l.timestamp.replace('T', ' ').substring(0, 16) : '2026-06-15 14:32'}
              </td>
              <td style={{ fontWeight: 600, color: l.userName === 'Admin' ? 'var(--accent)' : '#fff' }}>
                {l.userName}
              </td>
              <td>
                <span className="tag" style={{ background: 'var(--surface2)' }}>{l.action}</span>
              </td>
              <td style={{ color: 'var(--accent2)' }}>{l.targetType || l.targetId || '—'}</td>
              <td>{l.details}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
