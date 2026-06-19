'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './Sidebar.css';

const navItems = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Map View', href: '/map' },
  { label: 'Upload KML', href: '/upload' },
  { label: 'Nodes', href: '/nodes' },
  { label: 'Users', href: '/users' },
  { label: 'Audit Log', href: '/audit' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link${isActive ? ' active' : ''}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
