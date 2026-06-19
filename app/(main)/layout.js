'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import './layout.css';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '⊞' },
  { href: '/map', label: 'Map View', icon: '◫' },
  { href: '/upload', label: 'Upload KML', icon: '↑' },
  { href: '/nodes', label: 'Nodes', icon: '⬡' },
  { href: '/audit', label: 'Audit Log', icon: '☰' },
  { href: '/users', label: 'Users', icon: '⚇' },
];

export default function MainLayout({ children }) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title="Toggle sidebar"
          >
            ☰
          </button>
          <span className="app-logo">MineArchive</span>
          <span className="app-region">Ropar, Punjab</span>
        </div>
        <div className="header-right">
          <span className="header-user">Admin</span>
        </div>
      </header>

      <div className="app-body">
        {/* Sidebar */}
        <nav className={`app-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
            >
              <span className="sidebar-icon">{item.icon}</span>
              {!sidebarCollapsed && <span className="sidebar-label">{item.label}</span>}
            </Link>
          ))}
        </nav>

        {/* Main Content */}
        <main className="app-main">
          {children}
        </main>
      </div>
    </div>
  );
}
