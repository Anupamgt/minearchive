'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import './dashboard.css';

const MapWithNoSSR = dynamic(() => import('../../components/LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="dash-map-placeholder">
      <div style={{ fontSize: 13, color: 'var(--text)' }}>Loading OpenStreetMap Layer...</div>
    </div>
  ),
});

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState({ nodes: 12, uploads: 47, pending: 3, users: 5 });
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    fetch('/api/audit?limit=6')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setRecentActivity(
            data.map((item) => `${item.timestamp ? item.timestamp.split('T')[0] : 'Jun 15'} — ${item.action} by ${item.userName}: ${item.details}`)
          );
        } else {
          setRecentActivity([
            'Jun 15 — Ropar North Quarry — KML uploaded by Harpreet Singh',
            'Jun 14 — Sutlej River Pit — Encroachment report by Amit Sharma',
            'Jun 13 — Nangal Road Site — Routine survey by Harpreet Singh',
            'Jun 12 — Kiratpur Quarry — Restoration check by Priya Kaur',
            'Jun 10 — Ropar North Quarry — Boundary update by Amit Sharma',
          ]);
        }
      })
      .catch(() => {
        setRecentActivity([
          'Jun 15 — Ropar North Quarry — KML uploaded by Harpreet Singh',
          'Jun 14 — Sutlej River Pit — Encroachment report by Amit Sharma',
          'Jun 13 — Nangal Road Site — Routine survey by Harpreet Singh',
          'Jun 12 — Kiratpur Quarry — Restoration check by Priya Kaur',
          'Jun 10 — Ropar North Quarry — Boundary update by Amit Sharma',
        ]);
      });
  }, []);

  return (
    <div className="dash-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="dash-subtitle">
            Overview of enclosures, uploads and recent archive activity
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-strip">
        <div className="card stat-card">
          <div className="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="6" r="3" />
              <circle cx="18" cy="18" r="3" />
              <line x1="8.6" y1="10.7" x2="15.4" y2="7.3" />
              <line x1="8.6" y1="13.3" x2="15.4" y2="16.7" />
            </svg>
          </div>
          <div className="stat-text">
            <span className="stat-label">Nodes</span>
            <span className="stat-value">{stats.nodes}</span>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div className="stat-text">
            <span className="stat-label">Uploads</span>
            <span className="stat-value">{stats.uploads}</span>
          </div>
        </div>

        <div className="card stat-card stat-warning">
          <div className="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 15 14" />
            </svg>
          </div>
          <div className="stat-text">
            <span className="stat-label">Pending</span>
            <span className="stat-value">{stats.pending}</span>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="stat-text">
            <span className="stat-label">Users</span>
            <span className="stat-value">{stats.users}</span>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="dash-grid">
        {/* Map Column */}
        <div className="card dash-map-col">
          <div className="dash-col-header">Map View — Ropar District (OpenStreetMap)</div>
          <div className="dash-map-box" style={{ height: 380 }}>
            <MapWithNoSSR
              selectedNode={null}
              onSelectNode={(id) => router.push('/map')}
            />
          </div>
        </div>

        {/* Activity Column */}
        <div className="card dash-act-col">
          <div className="dash-col-header">Recent Activity</div>
          <div className="act-list">
            {recentActivity.map((act, i) => {
              const idx = act.indexOf('—');
              const time = idx > -1 ? act.slice(0, idx).trim() : '';
              const text = idx > -1 ? act.slice(idx + 1).trim() : act;
              return (
                <div className="act-row" key={i}>
                  {time ? <span className="act-time">{time}</span> : null}
                  <span className="act-text">{text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
