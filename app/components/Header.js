'use client';

import { useRouter } from 'next/navigation';
import './Header.css';

export default function Header() {
  const router = useRouter();

  const handleLogout = () => {
    router.push('/login');
  };

  return (
    <header className="header">
      <div className="header-logo">MineArchive</div>

      <div className="header-right">
        <div className="header-user">
          <span>Admin</span>
          <span className="header-user-arrow">▼</span>
        </div>
        <button className="header-logout" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
