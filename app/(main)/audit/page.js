'use client';

import { useState, useEffect, useMemo } from 'react';
import { useToast } from '../../components/ToastProvider';
import './audit.css';

function ActionTag({ action }) {
  const a = (action || '').toLowerCase();
  let cls = '';
  if (a.includes('breach')) cls = 'tag-red';
  else if (a.includes('upload')) cls = 'tag-green';
  else if (a.includes('archive') || a.includes('disable')) cls = 'tag-yellow';
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
    fetch('/api/audit?limit=200', { credentials: 'same-origin' })
      .then((res) => res.json())
      .then((data) => {
        setLogs(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setLogs([]);
        setLoading(false);
        showToast('Could not load the activity log.', 'error');
      });
  }, [showToast]);

  const actionOptions = useMemo(
    () => Array.from(new Set(logs.map((l) => l.action).filter(Boolean))).sort(),
    [logs]
  );
  const userOptions = useMemo(
    () => Array.from(new Set(logs.map((l) => l.userName).filter(Boolean))).sort(),
    [logs]
  );

  const filteredLogs = logs.filter((l) => {
    const term = searchTerm.toLowerCase();
    const matchSearch =
      term === '' ||
      l.details?.toLowerCase().includes(term) ||
      l.userName?.toLowerCase().includes(term) ||
      l.action?.toLowerCase().includes(term);
    const matchAction = filterAction === 'All Actions' || l.action === filterAction;
    const matchUser = filterUser === 'All Users' || l.userName === filterUser;
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
      l.timestamp ? String(l.timestamp).replace('T', ' ').substring(0, 16) : '',
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
              {actionOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div className="audit-field">
            <label htmlFor="audit-user">User</label>
            <select id="audit-user" className="input" value={filterUser} onChange={(e) => setFilterUser(e.target.value)}>
              <option>All Users</option>
              {userOptions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
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
                    {l.timestamp ? String(l.timestamp).replace('T', ' ').substring(0, 16) : '—'}
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
