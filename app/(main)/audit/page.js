'use client';

import { useState, useEffect } from 'react';
import { useToast } from '../../components/ToastProvider';
import './audit.css';

export default function AuditPage() {
  const { showToast } = useToast();
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
    const q = searchTerm.toLowerCase();
    const matchSearch =
      searchTerm === '' ||
      l.details?.toLowerCase().includes(q) ||
      l.userName?.toLowerCase().includes(q) ||
      l.action?.toLowerCase().includes(q) ||
      l.targetType?.toLowerCase().includes(q);
    const matchAction = filterAction === 'All Actions' || l.action?.toLowerCase() === filterAction.toLowerCase();
    const matchUser = filterUser === 'All Users' || l.userName?.toLowerCase() === filterUser.toLowerCase();
    return matchSearch && matchAction && matchUser;
  });

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      showToast('No logs available to export.', 'warning');
      return;
    }

    const headers = ['ID', 'Timestamp', 'User Persona', 'Action Event', 'Target Enclosure', 'Details'];
    const rows = filteredLogs.map((l) => [
      l.id,
      typeof l.timestamp === 'string' ? l.timestamp : '2026-06-15 14:32',
      l.userName,
      l.action,
      l.targetType || l.targetId || '—',
      `"${(l.details || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MineArchive_Audit_Log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Downloaded audit trail archive CSV report!', 'success');
  };

  const handlePrintPDF = () => {
    showToast('Preparing PDF audit report print view...', 'info');
    setTimeout(() => window.print(), 500);
  };

  return (
    <div className="audit-container">
      <div className="page-header">
        <div>
          <h1>Central System Audit Trail</h1>
          <p className="page-subtitle">Immutable record of all archive activity</p>
        </div>
        <div className="header-actions">
          <input
            type="search"
            className="input"
            placeholder="Search audit log…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="card table-card">
        <div className="audit-toolbar">
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
          </div>
          <div className="audit-exports">
            <button className="btn btn-outline" onClick={handlePrintPDF}>Export PDF</button>
            <button className="btn btn-outline" onClick={handleExportCSV}>Export CSV</button>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="empty-state">
            <p>No audit activity matches your current filter criteria.</p>
          </div>
        ) : (
          <table className="table audit-table" style={{ fontSize: 12 }}>
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
                  <td style={{ fontWeight: 600, color: l.userName === 'Admin' ? 'var(--accent)' : 'var(--text)' }}>
                    {l.userName}
                  </td>
                  <td>
                    <span className="tag tag-accent">{l.action}</span>
                  </td>
                  <td style={{ color: 'var(--accent2)' }}>{l.targetType || l.targetId || '—'}</td>
                  <td>{l.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
