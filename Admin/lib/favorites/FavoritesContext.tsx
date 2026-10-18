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
import { useBuyerAuth } from '@/lib/BuyerAuthProvider';

type FavoritesContextValue = {
  ready: boolean;
  authenticated: boolean;
  variantIds: Set<string>;
  isFavorite: (variantId: string | null | undefined) => boolean;
  toggle: (variantId: string) => Promise<'added' | 'removed' | 'auth' | 'error'>;
  refresh: () => Promise<void>;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const {
    ready: authReady,
    authenticated,
    refresh: refreshAuth,
  } = useBuyerAuth();
  const [ready, setReady] = useState(false);
  const [ids, setIds] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    if (!authenticated) {
      setIds([]);
      setReady(true);
      return;
    }
    try {
      const res = await fetch('/api/account/favorites', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!res.ok) {
        if (res.status === 401) {
          await refreshAuth();
        }
        setIds([]);
        setReady(true);
        return;
      }
      const data = (await res.json()) as { variantIds?: string[] };
      setIds(Array.isArray(data.variantIds) ? data.variantIds : []);
    } catch {
      setIds([]);
    } finally {
      setReady(true);
    }
  }, [authenticated, refreshAuth]);

  useEffect(() => {
    if (!authReady) return;
    void refresh();
  }, [authReady, authenticated, refresh]);

  const variantIds = useMemo(() => new Set(ids), [ids]);

  const isFavorite = useCallback(
    (variantId: string | null | undefined) =>
      Boolean(variantId && variantIds.has(variantId)),
    [variantIds],
  );

  const toggle = useCallback(
    async (variantId: string) => {
      if (!variantId) return 'error';
      if (!authenticated) return 'auth';
      const was = variantIds.has(variantId);
      setIds((prev) =>
        was ? prev.filter((id) => id !== variantId) : [variantId, ...prev],
      );
      try {
        const res = await fetch(
          `/api/account/favorites/${encodeURIComponent(variantId)}`,
          {
            method: was ? 'DELETE' : 'POST',
            credentials: 'same-origin',
          },
        );
        if (res.status === 401) {
          await refreshAuth();
          setIds((prev) =>
            was ? [...prev, variantId] : prev.filter((id) => id !== variantId),
          );
          return 'auth';
        }
        if (!res.ok) {
          setIds((prev) =>
            was ? [...prev, variantId] : prev.filter((id) => id !== variantId),
          );
          return 'error';
        }
        const data = (await res.json()) as { variantIds?: string[] };
        if (Array.isArray(data.variantIds)) setIds(data.variantIds);
        return was ? 'removed' : 'added';
      } catch {
        setIds((prev) =>
          was ? [...prev, variantId] : prev.filter((id) => id !== variantId),
        );
        return 'error';
      }
    },
    [authenticated, variantIds, refreshAuth],
  );

  const value = useMemo(
    () => ({
      ready: authReady && ready,
      authenticated,
      variantIds,
      isFavorite,
      toggle,
      refresh,
    }),
    [authReady, ready, authenticated, variantIds, isFavorite, toggle, refresh],
  );

  return (
    <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error('useFavorites must be used within FavoritesProvider');
  }
  return ctx;
}
