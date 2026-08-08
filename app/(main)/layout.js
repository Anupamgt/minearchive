'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { readSessionFromCookie } from '../../lib/session-client';
import './layout.css';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/map', label: 'Map View', icon: 'map' },
  { href: '/upload', label: 'Upload KML', icon: 'upload' },
  { href: '/nodes', label: 'Nodes', icon: 'nodes' },
  { href: '/audit', label: 'Audit Log', icon: 'audit' },
  { href: '/users', label: 'Users', icon: 'users' },
];

const DEFAULT_USER = { name: 'Central Admin', role: 'admin' };

function NavIcon({ name }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  switch (name) {
    case 'dashboard':
      return (
        <svg {...common} aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case 'map':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M12 21s-6-5.686-6-10a6 6 0 1 1 12 0c0 4.314-6 10-6 10z" />
          <circle cx="12" cy="11" r="2.2" />
        </svg>
      );
    case 'upload':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M12 16V4" />
          <path d="M7 9l5-5 5 5" />
          <path d="M5 20h14" />
        </svg>
      );
    case 'nodes':
      return (
        <svg {...common} aria-hidden="true">
          <path d="M12 3l7 4v10l-7 4-7-4V7z" />
          <path d="M12 3v6" />
          <path d="M12 9l-4.5 2.5" />
          <path d="M12 9l4.5 2.5" />
        </svg>
      );
    case 'audit':
      return (
        <svg {...common} aria-hidden="true">
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 9h6" />
          <path d="M9 13h6" />
          <path d="M9 17h4" />
        </svg>
      );
    case 'users':
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
          <path d="M16 5.2a3 3 0 0 1 0 5.8" />
          <path d="M17 20a5.5 5.5 0 0 0-3-4.9" />
        </svg>
      );
    default:
      return null;
  }
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function MainLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [user, setUser] = useState(DEFAULT_USER);

  useEffect(() => {
    const session = readSessionFromCookie();
    if (session && session.name) {
      setUser({ name: session.name, role: session.role || 'viewer' });
    }
  }, []);

  const isAdmin = user.role === 'admin';

  const handleLogout = () => {
    document.cookie = 'minearchive_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/login');
  };

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
              aria-hidden="true"
            >
              <path d="M4 6h16" />
              <path d="M4 12h16" />
              <path d="M4 18h16" />
            </svg>
          </button>
          <div className="app-brand">
            <span className="app-logo-mark" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19V6l6 6 6-6v13" />
              </svg>
            </span>
            <span className="app-logo">MineArchive</span>
          </div>
          <span className="app-region">Ropar, Punjab</span>
        </div>
        <div className="header-right">
          <div className="user-chip">
            <span className="user-avatar" aria-hidden="true">{getInitials(user.name)}</span>
            <span className="user-name">{user.name}</span>
            <span className={`tag ${isAdmin ? 'tag-accent' : 'tag-green'}`}>
              {(user.role || '').toUpperCase()}
            </span>
          </div>
          <button className="btn btn-outline btn-sm" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <div className="app-body">
        {/* Sidebar */}
        <nav className={`app-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="sidebar-nav">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <span className="sidebar-icon">
                  <NavIcon name={item.icon} />
                </span>
                {!sidebarCollapsed && <span className="sidebar-label">{item.label}</span>}
              </Link>
            ))}
          </div>

          {!sidebarCollapsed && (
            <div className="sidebar-footer">
              <span className={`tag ${isAdmin ? 'tag-accent' : 'tag-green'}`}>
                {isAdmin ? 'ADMIN MODE' : 'READ ONLY'}
              </span>
            </div>
          )}
        </nav>

        {/* Main Content */}
        <main className="app-main">
          {children}
        </main>
      </div>
    </div>
  );
}
