'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import './Header.css';

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState({ name: 'Central Admin', role: 'Admin' });

  useEffect(() => {
    // Read session cookie or local storage persona
    const cookies = document.cookie.split('; ');
    const sessionRow = cookies.find((c) => c.startsWith('minearchive_session='));
    if (sessionRow) {
      try {
        const val = sessionRow.split('=')[1];
        const decoded = JSON.parse(Buffer.from(val, 'base64').toString('utf8'));
        setUser(decoded);
      } catch {}
    }
  }, []);

  const handlePersonaToggle = (newRole) => {
    const mockUser = newRole === 'Admin' 
      ? { id: 'admin-1', name: 'Central Admin', email: 'admin@minearchive.co', role: 'Admin' }
      : { id: 'user-1', name: 'Harpreet Singh', email: 'harpreet@mine.co', role: 'User' };
    
    const token = Buffer.from(JSON.stringify(mockUser)).toString('base64');
    document.cookie = `minearchive_session=${token}; path=/; max-age=604800`;
    setUser(mockUser);
    window.location.reload();
  };

  return (
    <header className="header">
      <div className="header-logo" onClick={() => router.push('/dashboard')} style={{ cursor: 'pointer' }}>
        MineArchive <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)', marginLeft: 8 }}>v1.0 PostGIS</span>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Quick Demo Persona Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg)', border: '1px solid var(--border)', padding: '2px 8px', fontSize: 11 }}>
          <span style={{ color: 'var(--muted)', marginRight: 6 }}>Persona:</span>
          <button
            onClick={() => handlePersonaToggle('Admin')}
            style={{ background: user.role === 'Admin' ? 'var(--accent)' : 'transparent', color: '#fff', border: 'none', padding: '2px 6px', cursor: 'pointer', fontWeight: user.role === 'Admin' ? 700 : 400 }}
          >
            Admin
          </button>
          <button
            onClick={() => handlePersonaToggle('User')}
            style={{ background: user.role === 'User' ? 'var(--green)' : 'transparent', color: '#fff', border: 'none', padding: '2px 6px', cursor: 'pointer', fontWeight: user.role === 'User' ? 700 : 400 }}
          >
            User
          </button>
        </div>

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
