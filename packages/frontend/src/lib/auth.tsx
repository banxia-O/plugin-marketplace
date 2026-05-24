import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AuthResponse, AuthUser, LoginRequest, RegisterRequest } from '@ppx/shared';
import { apiClient } from '../api/client.js';
import { clearToken, getToken, setToken } from './token.js';

interface AuthValue {
  user: AuthUser | null;
  ready: boolean;
  login: (body: LoginRequest) => Promise<void>;
  register: (body: RegisterRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // GitHub OAuth 回调通过 URL fragment 交回 token：/#token=...
    const match = window.location.hash.match(/token=([^&]+)/);
    if (match && match[1]) {
      setToken(decodeURIComponent(match[1]));
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    if (getToken()) {
      apiClient
        .getMe()
        .then((r) => setUser(r.user))
        .catch(() => clearToken())
        .finally(() => setReady(true));
    } else {
      setReady(true);
    }
  }, []);

  function applySession(resp: AuthResponse) {
    setToken(resp.token);
    setUser(resp.user);
  }

  async function login(body: LoginRequest) {
    applySession(await apiClient.login(body));
  }

  async function register(body: RegisterRequest) {
    applySession(await apiClient.register(body));
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用');
  return ctx;
}
