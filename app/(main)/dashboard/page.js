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
      {/* Stats Strip */}
      <div className="stats-strip">
        <div className="stat-box">
          <span className="stat-label">Nodes: </span>
          <span className="stat-value">{stats.nodes}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Uploads: </span>
          <span className="stat-value">{stats.uploads}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Pending: </span>
          <span className="stat-value" style={{ color: 'var(--yellow)' }}>{stats.pending}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Users: </span>
          <span className="stat-value">{stats.users}</span>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="dash-grid">
        {/* Map Column */}
        <div className="dash-map-col">
          <div className="dash-col-header">MAP VIEW — ROPAR DISTRICT (OPENSTREETMAP)</div>
          <div className="dash-map-box" style={{ height: 380 }}>
            <MapWithNoSSR
              selectedNode={null}
              onSelectNode={(id) => router.push('/map')}
            />
          </div>
        </div>

        {/* Activity Column */}
        <div className="dash-act-col">
          <div className="dash-col-header">RECENT ACTIVITY ARCHIVE</div>
          <div className="act-list">
            {recentActivity.map((act, i) => (
              <div className="act-row" key={i}>
                {act}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
