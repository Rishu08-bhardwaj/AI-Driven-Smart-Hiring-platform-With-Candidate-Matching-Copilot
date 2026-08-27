import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authService } from '../services/index.js';
import { setAccessToken, getAccessToken, setUnauthorizedHandler } from '../services/apiClient.js';
import { roleHasPermission } from '../utils/permissions.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      /* ignore network errors on logout */
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  // Force-logout when a token refresh ultimately fails.
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
  }, []);

  // Rehydrate the session on first load if an access token exists.
  useEffect(() => {
    let active = true;
    async function bootstrap() {
      if (!getAccessToken()) {
        setLoading(false);
        return;
      }
      try {
        const res = await authService.me();
        if (active) setUser(res.data.user);
      } catch {
        setAccessToken(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    bootstrap();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const res = await authService.login(credentials);
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const can = useCallback(
    (...perms) => (user ? perms.some((p) => roleHasPermission(user.role, p)) : false),
    [user]
  );

  const value = { user, loading, login, logout, can, isAuthenticated: !!user };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
