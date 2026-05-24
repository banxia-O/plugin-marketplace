import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload } from 'lucide-react';
import { SearchBox } from './SearchBox.js';
import { AuthModal } from './AuthModal.js';
import { useAuth } from '../lib/auth.js';

export function Navbar() {
  const { user, logout } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  return (
    <header className="navbar">
      <Link to="/" className="navbar__logo">
        <span aria-hidden>🏪</span>
        <span>插件百宝阁</span>
      </Link>
      <div className="navbar__search">
        <SearchBox />
      </div>
      <div className="navbar__spacer" />

      <Link to="/upload" className="btn btn-ghost btn-sm">
        <Upload size={15} aria-hidden /> 上传插件
      </Link>

      {user ? (
        <div className="navbar__user">
          {user.avatarUrl && <img className="navbar__avatar" src={user.avatarUrl} alt="" />}
          <span className="navbar__username">{user.username}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
            退出
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAuth(true)}>
          登录
        </button>
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </header>
  );
}
