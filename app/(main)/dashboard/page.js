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
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="page-subtitle">Overview of monitoring areas, uploads and recent activity.</p>
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
              onSelectNode={(id) => router.push('/map')}
            />
          </div>
        </div>

        {/* Activity Column */}
        <div className="card dash-act-col">
          <div className="card-header dash-col-header">Recent Activity</div>
          <div className="act-list">
            {recentActivity.map((act, i) => {
              const [ts, ...rest] = act.split(' — ');
              const main = rest.join(' — ');
              return (
                <div className="act-row" key={i}>
                  {main ? (
                    <>
                      <span className="act-time">{ts}</span>
                      <span className="act-text">{main}</span>
                    </>
                  ) : (
                    <span className="act-text">{act}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
