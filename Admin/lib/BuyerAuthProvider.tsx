'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';

export type BuyerSessionUser = {
  id: string;
  email: string;
  role: string;
  displayName: string | null;
  phone: string | null;
};

export type BuyerAuthContextValue = {
  /** Первый fetch /api/auth/session завершён. */
  ready: boolean;
  authenticated: boolean;
  user: BuyerSessionUser | null;
  refresh: () => Promise<void>;
  logout: (opts?: { redirectTo?: string }) => Promise<void>;
};

const BuyerAuthContext = createContext<BuyerAuthContextValue | null>(null);

type SessionResponse = {
  authenticated?: boolean;
  user?: BuyerSessionUser;
};

async function fetchBuyerSession(): Promise<{
  authenticated: boolean;
  user: BuyerSessionUser | null;
}> {
  const res = await fetch('/api/auth/session', {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => ({}))) as SessionResponse;
  if (!data.authenticated || !data.user?.id) {
    return { authenticated: false, user: null };
  }
  return { authenticated: true, user: data.user };
}

export function BuyerAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<BuyerSessionUser | null>(null);

  const refresh = useCallback(async () => {
    try {
      const session = await fetchBuyerSession();
      setAuthenticated(session.authenticated);
      setUser(session.user);
    } catch {
      setAuthenticated(false);
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async (opts?: { redirectTo?: string }) => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch {
      /* ignore */
    }
    setAuthenticated(false);
    setUser(null);
    setReady(true);
    router.replace(opts?.redirectTo ?? '/');
    router.refresh();
  }, [router]);

  const value = useMemo<BuyerAuthContextValue>(
    () => ({
      ready,
      authenticated,
      user,
      refresh,
      logout,
    }),
    [ready, authenticated, user, refresh, logout],
  );

  return (
    <BuyerAuthContext.Provider value={value}>{children}</BuyerAuthContext.Provider>
  );
}

export function useBuyerAuth(): BuyerAuthContextValue {
  const ctx = useContext(BuyerAuthContext);
  if (!ctx) {
    throw new Error('useBuyerAuth must be used within BuyerAuthProvider');
  }
  return ctx;
}

export function useBuyerAuthOptional(): BuyerAuthContextValue | null {
  return useContext(BuyerAuthContext);
}
