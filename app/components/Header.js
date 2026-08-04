'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { readSessionFromCookie } from '../../lib/session-client';
import './Header.css';

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState({ name: 'Central Admin', role: 'Admin' });

  useEffect(() => {
    const decoded = readSessionFromCookie();
    if (decoded) setUser(decoded);
  }, []);

  return (
    <header className="header">
      <div className="header-logo" onClick={() => router.push('/dashboard')} style={{ cursor: 'pointer' }}>
        MineArchive <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)', marginLeft: 8 }}>v1.0 PostGIS</span>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div className="header-user">
          <span className="user-name" style={{ color: user.role === 'Admin' ? 'var(--accent2)' : 'var(--green)' }}>
            {user.name} ({user.role})
          </span>
        </div>

        <button
          className="btn btn-outline"
          style={{ padding: '4px 10px', fontSize: 11 }}
          onClick={() => {
            document.cookie = 'minearchive_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            router.push('/login');
          }}
        >
          Logout
        </button>
      </div>
    </header>
  );
}
