import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { apiClient } from '../api/client.js';
import { useAuth } from '../lib/auth.js';

type Mode = 'login' | 'register';

export function AuthModal({ onClose }: { onClose: () => void }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await login({ identifier, password });
      } else {
        await register({ username, email: email.trim() || undefined, password });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请重试');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="modal__close" onClick={onClose} aria-label="关闭">
          <X size={18} />
        </button>

        <div className="modal__tabs">
          <button
            type="button"
            className={`modal__tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => setMode('login')}
          >
            登录
          </button>
          <button
            type="button"
            className={`modal__tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => setMode('register')}
          >
            注册
          </button>
        </div>

        <form onSubmit={onSubmit}>
          {mode === 'login' ? (
            <div className="form-group">
              <label className="form-label" htmlFor="auth-id">用户名或邮箱</label>
              <input
                id="auth-id"
                className="form-input"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="auth-username">用户名</label>
                <input
                  id="auth-username"
                  className="form-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="3–32 位，字母/数字/下划线/连字符"
                  autoComplete="username"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="auth-email">
                  邮箱 <span className="form-hint">（选填）</span>
                </label>
                <input
                  id="auth-email"
                  className="form-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="auth-password">密码</label>
            <input
              id="auth-password"
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? '至少 8 位' : ''}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: '100%' }}>
            {busy ? '处理中…' : mode === 'login' ? '登录' : '注册'}
          </button>
        </form>

        <div className="modal__divider"><span>或</span></div>

        <a href={apiClient.githubLoginUrl()} className="btn btn-ghost" style={{ width: '100%' }}>
          使用 GitHub 账号登录
        </a>
      </div>
    </div>
  );
}
