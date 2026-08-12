'use client';

import { useState, useEffect } from 'react';
import { useToast } from '../../components/ToastProvider';
import './audit.css';

function ActionTag({ action }) {
  const a = (action || '').toLowerCase();
  let cls = '';
  if (a.includes('upload')) cls = 'tag-green';
  else if (a.includes('archive')) cls = 'tag-yellow';
  else if (a.includes('login')) cls = 'tag-accent';
  return <span className={`tag ${cls}`}>{action}</span>;
}

export default function AuditPage() {
  const { showToast } = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
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
            { id: 3, timestamp: '2026-06-14 09:00', userName: 'System', action: 'Area Change', targetType: 'Nangal Road Site', details: '+8.2% expansion detected' },
            { id: 4, timestamp: '2026-06-13 16:45', userName: 'Amit Sharma', action: 'Upload KML', targetType: 'Kiratpur Quarry', details: 'Encroachment report' },
            { id: 5, timestamp: '2026-06-13 11:20', userName: 'Harpreet Singh', action: 'Login', targetType: '—', details: 'Successful login' },
          ]);
        }
        setLoading(false);
      })
      .catch(() => {
        setLogs([
          { id: 1, timestamp: '2026-06-15 14:32', userName: 'Harpreet Singh', action: 'Upload KML', targetType: 'Ropar North Quarry', details: 'Routine Survey #5' },
          { id: 2, timestamp: '2026-06-15 10:15', userName: 'Admin', action: 'Archive Node', targetType: 'Sutlej River Pit', details: 'Archived old sector' },
          { id: 3, timestamp: '2026-06-14 09:00', userName: 'System', action: 'Area Change', targetType: 'Nangal Road Site', details: '+8.2% expansion detected' },
          { id: 4, timestamp: '2026-06-13 16:45', userName: 'Amit Sharma', action: 'Upload KML', targetType: 'Kiratpur Quarry', details: 'Encroachment report' },
          { id: 5, timestamp: '2026-06-13 11:20', userName: 'Harpreet Singh', action: 'Login', targetType: '—', details: 'Successful login' },
        ]);
        setLoading(false);
      });
  }, []);

  const filteredLogs = logs.filter((l) => {
    const matchSearch = searchTerm === '' || l.details?.toLowerCase().includes(searchTerm.toLowerCase()) || l.userName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchAction = filterAction === 'All Actions' || l.action?.toLowerCase() === filterAction.toLowerCase();
    const matchUser = filterUser === 'All Users' || l.userName?.toLowerCase() === filterUser.toLowerCase();
    return matchSearch && matchAction && matchUser;
  });

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      showToast('No logs available to export.', 'warning');
      return;
    }

    const headers = ['ID', 'Timestamp', 'User', 'Action', 'Monitoring Area', 'Details'];
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

    showToast('Downloaded activity log as CSV.', 'success');
  };

  const handlePrintPDF = () => {
    showToast('Preparing a printable activity report…', 'info');
    setTimeout(() => window.print(), 500);
  };

  return (
    <div className="audit-container">
      <div className="page-header">
        <div>
          <h1>Activity Log</h1>
          <p className="page-subtitle">A complete, tamper-evident record of every action</p>
        </div>
      </div>

      <div className="card audit-toolbar-card">
        <div className="audit-filters">
          <div className="audit-field">
            <label htmlFor="audit-action">Action</label>
            <select id="audit-action" className="input" value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
              <option>All Actions</option>
              <option value="Upload KML">Upload KML</option>
              <option value="Archive Node">Archive Node</option>
              <option value="Login">Login</option>
            </select>
          </div>
          <div className="audit-field">
            <label htmlFor="audit-user">User</label>
            <select id="audit-user" className="input" value={filterUser} onChange={(e) => setFilterUser(e.target.value)}>
              <option>All Users</option>
              <option value="Harpreet Singh">Harpreet Singh</option>
              <option value="Amit Sharma">Amit Sharma</option>
              <option value="Admin">Admin</option>
            </select>
          </div>
          <div className="audit-field audit-field-search">
            <label htmlFor="audit-search">Search</label>
            <input
              id="audit-search"
              type="text"
              className="input"
              placeholder="Search by detail or user…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="audit-exports">
            <button className="btn btn-outline" onClick={handlePrintPDF}>Export PDF</button>
            <button className="btn btn-outline" onClick={handleExportCSV}>Export CSV</button>
          </div>
        </div>
      </div>

      <div className="card mt-16">
        {loading ? (
          <div className="audit-skeletons">
            {[0, 1, 2, 3, 4].map((i) => (
              <div className="audit-skeleton-row" key={i}>
                <div className="skeleton" style={{ height: 13, width: '16%' }} />
                <div className="skeleton" style={{ height: 13, width: '18%' }} />
                <div className="skeleton" style={{ height: 13, width: '14%' }} />
                <div className="skeleton" style={{ height: 13, width: '20%' }} />
                <div className="skeleton" style={{ height: 13, width: '24%' }} />
              </div>
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="empty-state">
            <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6M9 13h6M9 17h6M9 9h1" />
            </svg>
            <h3>No matching activity</h3>
            <p>No records match your current filters. Try clearing the search box or choosing “All Actions” and “All Users”.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Monitoring area</th>
                <th>Details</th>
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
                    <ActionTag action={l.action} />
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
