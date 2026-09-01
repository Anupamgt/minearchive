'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { readSessionFromCookie } from '../../../lib/session-client';
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
  const [stats, setStats] = useState({ nodes: 0, uploads: 0, pending: 0, users: 0 });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch('/api/stats', { credentials: 'same-origin' })
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.nodes === 'number') setStats(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const session = readSessionFromCookie();
    const admin = (session?.role || '').toLowerCase() === 'admin';
    setIsAdmin(admin);

    fetch('/api/audit?limit=6', { credentials: 'same-origin' })
      .then((res) => res.json())
      .then((data) => {
        setRecentActivity(
          Array.isArray(data)
            ? data.map((item) => ({
                id: item.id,
                time: item.timestamp ? String(item.timestamp).split('T')[0] : '—',
                text: `${item.action} by ${item.userName}${item.details ? `: ${item.details}` : ''}`,
              }))
            : []
        );
        setLoadingActivity(false);
      })
      .catch(() => {
        setRecentActivity([]);
        setLoadingActivity(false);
      });
  }, []);

  return (
    <div className="dash-container">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="page-subtitle">
            {isAdmin
              ? 'Overview of monitoring areas, uploads and recent activity.'
              : 'Overview of your assigned monitoring areas and their activity.'}
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stats-strip">
        <div className="card stat-card">
          <div className="stat-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 3 3 5.5v15L9 18l6 3 6-2.5v-15L15 6 9 3z" />
              <path d="M9 3v15M15 6v15" />
            </svg>
          </div>
          <div className="stat-text">
            <div className="stat-label">Monitoring Areas</div>
            <div className="stat-value">{stats.nodes}</div>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" />
              <path d="M14 3v5h5M9 13h6M9 17h6" />
            </svg>
          </div>
          <div className="stat-text">
            <div className="stat-label">Boundary Files</div>
            <div className="stat-value">{stats.uploads}</div>
          </div>
        </div>

        <div className="card stat-card stat-card-pending">
          <div className="stat-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </div>
          <div className="stat-text">
            <div className="stat-label">Pending Review</div>
            <div className="stat-value">{stats.pending}</div>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="stat-text">
            <div className="stat-label">Users</div>
            <div className="stat-value">{stats.users}</div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="dash-grid">
        {/* Map Column */}
        <div className="card dash-map-col">
          <div className="card-header dash-col-header">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 3 3 5.5v15L9 18l6 3 6-2.5v-15L15 6 9 3z" />
              <path d="M9 3v15M15 6v15" />
            </svg>
            Map overview — Ropar District
          </div>
          <div className="dash-map-box" style={{ height: 380 }}>
            <MapWithNoSSR
              selectedNode={null}
              onSelectNode={(id) => router.push(`/map?nodeId=${encodeURIComponent(id)}`)}
            />
          </div>
        </div>

        {/* Activity: admins see the full trail; field users only assigned sites */}
        <div className="card dash-act-col">
          <div className="card-header dash-col-header">
            {isAdmin ? 'Recent Activity' : 'Activity on your sites'}
          </div>
          <div className="act-list">
            {loadingActivity ? (
              [0, 1, 2, 3, 4].map((i) => (
                <div className="act-row" key={i}>
                  <div className="skeleton" style={{ height: 13, width: '100%' }} />
                </div>
              ))
            ) : recentActivity.length === 0 ? (
              <div className="act-row">
                <span className="act-text">
                  {isAdmin
                    ? 'No activity yet. Uploads, area changes and sign-ins will appear here.'
                    : 'No activity yet on your assigned sites. Uploads and area changes for those sites will appear here.'}
                </span>
              </div>
            ) : (
              recentActivity.map((act) => (
                <div className="act-row" key={act.id}>
                  <span className="act-time">{act.time}</span>
                  <span className="act-text">{act.text}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
