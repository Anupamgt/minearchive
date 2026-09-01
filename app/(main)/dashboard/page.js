'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
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

function hrefForActivity(act, isAdmin) {
  if (!isAdmin) return '/map';
  const action = (act.action || '').toLowerCase();
  if (action.includes('user')) return '/users';
  if (action.includes('upload') || action.includes('breach')) return '/map';
  if (action.includes('approve')) return '/nodes?status=proposed';
  if (action.includes('node') || action.includes('archive') || action.includes('restore')) {
    return '/nodes';
  }
  return '/audit';
}

function StatCard({ href, pending, label, value, children }) {
  const className = `card stat-card${pending ? ' stat-card-pending' : ''}${href ? ' stat-card-link' : ''}`;
  const inner = (
    <>
      <div className="stat-icon" aria-hidden="true">
        {children}
      </div>
      <div className="stat-text">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
      </div>
    </>
  );
  if (!href) {
    return <div className={className}>{inner}</div>;
  }
  return (
    <Link href={href} className={className} title={`Open ${label}`}>
      {inner}
    </Link>
  );
}

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
                action: item.action,
                targetId: item.targetId,
                targetType: item.targetType,
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
              ? 'Overview of monitoring areas, uploads and recent activity. Click a card to open it.'
              : 'Overview of your assigned monitoring areas and their activity. Click a card to open it.'}
          </p>
        </div>
      </div>

      <div className="stats-strip">
        <StatCard
          href={isAdmin ? '/nodes' : '/map'}
          label="Monitoring Areas"
          value={stats.nodes}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 3 3 5.5v15L9 18l6 3 6-2.5v-15L15 6 9 3z" />
            <path d="M9 3v15M15 6v15" />
          </svg>
        </StatCard>

        <StatCard href="/upload" label="Boundary Files" value={stats.uploads}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" />
            <path d="M14 3v5h5M9 13h6M9 17h6" />
          </svg>
        </StatCard>

        <StatCard
          href={isAdmin ? '/nodes?status=proposed' : '/map'}
          pending
          label="Pending Review"
          value={stats.pending}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </StatCard>

        <StatCard href={isAdmin ? '/users' : null} label="Users" value={stats.users}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </StatCard>
      </div>

      <div className="dash-grid">
        <div className="card dash-map-col">
          <Link href="/map" className="card-header dash-col-header dash-col-link" title="Open map">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 3 3 5.5v15L9 18l6 3 6-2.5v-15L15 6 9 3z" />
              <path d="M9 3v15M15 6v15" />
            </svg>
            Map overview — Ropar District
            <span className="dash-col-hint">Open map</span>
          </Link>
          <div className="dash-map-box" style={{ height: 380 }}>
            <MapWithNoSSR
              selectedNode={null}
              onSelectNode={(id) => router.push(`/map?nodeId=${encodeURIComponent(id)}`)}
            />
          </div>
        </div>

        <div className="card dash-act-col">
          {isAdmin ? (
            <Link href="/audit" className="card-header dash-col-header dash-col-link" title="Open activity log">
              Recent Activity
              <span className="dash-col-hint">View all</span>
            </Link>
          ) : (
            <div className="card-header dash-col-header">Activity on your sites</div>
          )}
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
                <Link
                  key={act.id}
                  href={hrefForActivity(act, isAdmin)}
                  className="act-row act-row-link"
                  title="Open related page"
                >
                  <span className="act-time">{act.time}</span>
                  <span className="act-text">{act.text}</span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
