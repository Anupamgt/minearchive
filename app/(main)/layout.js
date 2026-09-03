'use client';

import { Suspense, useState, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { readSessionFromCookie } from '../../lib/session-client';
import './layout.css';

const ICONS = {
  dashboard: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  map: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
    </svg>
  ),
  upload: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  nodes: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 10c0 5-8 11-8 11s-8-6-8-11a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  ),
  audit: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
      <line x1="9" y1="10" x2="15" y2="10" />
      <line x1="9" y1="14" x2="15" y2="14" />
      <line x1="9" y1="18" x2="13" y2="18" />
    </svg>
  ),
  reviews: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  users: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
};

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: ICONS.dashboard },
  { href: '/map', label: 'Map', icon: ICONS.map },
  { href: '/upload', label: 'Upload Boundary', icon: ICONS.upload },
  { href: '/nodes', label: 'Districts', icon: ICONS.nodes, adminOnly: true },
  {
    href: '/nodes?status=proposed',
    label: 'Reviews',
    icon: ICONS.reviews,
    adminOnly: true,
    match: 'reviews',
  },
  { href: '/audit', label: 'Activity Log', icon: ICONS.audit, adminOnly: true },
  { href: '/users', label: 'Users', icon: ICONS.users, adminOnly: true },
];

function navItemIsActive(item, pathname, status) {
  if (item.match === 'reviews') {
    return pathname === '/nodes' && status === 'proposed';
  }
  if (item.href === '/nodes') {
    return pathname === '/nodes' && status !== 'proposed';
  }
  return pathname === item.href;
}

function SidebarNav({ collapsed, isAdmin }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const status = searchParams.get('status');
  const visibleNav = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="sidebar-nav">
      {visibleNav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          title={item.label}
          className={`sidebar-link ${navItemIsActive(item, pathname, status) ? 'active' : ''}`}
        >
          <span className="sidebar-indicator" aria-hidden="true" />
          <span className="sidebar-icon">{item.icon}</span>
          {!collapsed && <span className="sidebar-label">{item.label}</span>}
        </Link>
      ))}
    </div>
  );
}

const FALLBACK_USER = { name: '', role: '' };

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function MainLayout({ children }) {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [user, setUser] = useState(FALLBACK_USER);

  useEffect(() => {
    const session = readSessionFromCookie();
    if (session && session.name) {
      setUser({ name: session.name, role: session.role || 'user' });
    }
  }, []);

  const handleSignOut = () => {
    document.cookie =
      'minearchive_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/login');
  };

  const isAdmin = (user.role || '').toLowerCase() === 'admin';
  const roleTagClass = isAdmin ? 'tag tag-accent' : 'tag tag-green';

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title="Toggle sidebar"
            aria-label="Toggle sidebar"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>

          <div className="app-brand">
            <span className="brand-mark" aria-hidden="true">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 10c0 5-8 11-8 11s-8-6-8-11a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="2.6" />
              </svg>
            </span>
            <span className="app-logo">MineArchive</span>
          </div>

          <span className="app-region">Ropar, Punjab</span>
        </div>

        <div className="header-right">
          <div className="header-user">
            <span className="user-avatar" aria-hidden="true">
              {getInitials(user.name)}
            </span>
            <span className="user-meta">
              <span className="user-name">{user.name}</span>
              <span className={roleTagClass}>{user.role}</span>
            </span>
            <button
              className="btn btn-outline btn-sm"
              onClick={handleSignOut}
              title="Sign out"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="app-body">
        {/* Sidebar */}
        <nav className={`app-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <Suspense fallback={<div className="sidebar-nav" />}>
            <SidebarNav collapsed={sidebarCollapsed} isAdmin={isAdmin} />
          </Suspense>

          {!sidebarCollapsed && (
            <div className="sidebar-footer">
              <span className="tag">MineArchive v1.0.0</span>
            </div>
          )}
        </nav>

        {/* Main Content */}
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
