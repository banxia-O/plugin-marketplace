import { Link } from 'react-router-dom';
import { SearchBox } from './SearchBox.js';

export function Navbar() {
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
      <button type="button" className="btn btn-ghost btn-sm" title="登录将在 Phase 3 接入">
        登录
      </button>
    </header>
  );
}
