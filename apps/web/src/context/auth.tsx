import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, tokenStore } from '../lib/api';
import type { User } from '../lib/types';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: { name: string; email: string; password: string; role: 'CUSTOMER' | 'MERCHANT' }) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null>(() => tokenStore.get());
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(!!tokenStore.get());

  const apply = useCallback(
    (t: string | null, u: User | null) => {
      tokenStore.set(t);
      setToken(t);
      setUser(u);
      qc.clear();
    },
    [qc],
  );

  useEffect(() => {
    if (!token) return;
    api
      .me()
      .then(setUser)
      .catch(() => apply(null, null))
      .finally(() => setLoading(false));
    // only on first load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      token,
      loading,
      login: async (email, password) => {
        const r = await api.login(email, password);
        apply(r.token, r.user);
        return r.user;
      },
      register: async (input) => {
        const r = await api.register(input);
        apply(r.token, r.user);
        return r.user;
      },
      logout: () => apply(null, null),
      refresh: async () => setUser(await api.me()),
    }),
    [user, token, loading, apply],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
