'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { readSessionFromCookie } from '../../lib/session-client';
import './Sidebar.css';

export default function Sidebar() {
  const pathname = usePathname();
  const [role, setRole] = useState('Admin');

  useEffect(() => {
    const decoded = readSessionFromCookie();
    if (decoded && decoded.role) setRole(decoded.role);
  }, []);

  const isAdmin = role.toLowerCase() === 'admin';

  const NAV_ITEMS = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Map View', href: '/map' },
    { label: 'Upload KML', href: '/upload' },
    { label: 'Audit Log', href: '/audit' },
  ];

  if (isAdmin) {
    NAV_ITEMS.splice(3, 0, { label: 'Nodes', href: '/nodes' });
    NAV_ITEMS.splice(4, 0, { label: 'Users', href: '/users' });
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link${isActive ? ' active' : ''}`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <div style={{ padding: 14, marginTop: 'auto', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--muted)' }}>
        <div>Enclosure Monitor</div>
        <div style={{ color: isAdmin ? 'var(--accent2)' : 'var(--green)', fontWeight: 600, marginTop: 2 }}>
          Mode: {role.toUpperCase()}
        </div>
      </div>
    </aside>
  );
}
