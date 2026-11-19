import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth as authApi, setAccessToken, getAccessToken } from '../lib/api';
import type { AdminUser } from '../lib/types';

interface AuthState {
  user: AdminUser | null;
  loading: boolean;
  mfaRequired: boolean;
  login: (email: string, otp: string) => Promise<{ mfaRequired?: boolean }>;
  verifyMfa: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);

  const loadUser = useCallback(async () => {
    if (!getAccessToken()) { setLoading(false); return; }
    try {
      const res = await authApi.me();
      if (res.success && res.data) {
        setUser({ ...res.data, mfaEnabled: res.data.mfaEnabled, mfaVerified: true });
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    authApi.refresh().then(res => {
      if (res.success && res.data?.accessToken) {
        setAccessToken(res.data.accessToken);
        loadUser();
      } else { setLoading(false); }
    }).catch(() => setLoading(false));
  }, [loadUser]);

  const login = async (email: string, otp: string): Promise<{ mfaRequired?: boolean }> => {
    const res = await authApi.verifyOtp(email, otp);
    if (!res.success) throw new Error(res.error?.message ?? 'Login failed');
    if (res.data?.mfaRequired) { setMfaRequired(true); return { mfaRequired: true }; }
    if (res.data?.accessToken) { setAccessToken(res.data.accessToken); await loadUser(); }
    return {};
  };

  const verifyMfa = async (code: string) => {
    const res = await authApi.verifyMfa(code);
    if (!res.success) throw new Error(res.error?.message ?? 'MFA verification failed');
    if (res.data?.accessToken) {
      setAccessToken(res.data.accessToken);
      setMfaRequired(false);
      await loadUser();
    }
  };

  const logout = async () => {
    await authApi.logout().catch(() => {});
    setAccessToken(null);
    setUser(null);
  };

  const hasPermission = (permission: string) => {
    if (!user) return false;
    if (user.role === 'super_admin') return true;
    return user.permissions.includes(permission);
  };

  return (
    <AuthContext.Provider value={{ user, loading, mfaRequired, login, verifyMfa, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
