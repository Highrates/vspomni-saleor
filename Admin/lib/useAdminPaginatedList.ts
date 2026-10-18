'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AdminBackendRequestError,
  adminBackendJson,
} from '@/lib/adminBackendFetch';

export type AdminPaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

type UseAdminPaginatedListOptions<T> = {
  /** API path builder; called with current page/limit/q. */
  buildPath: (args: { page: number; limit: number; q: string }) => string;
  limit?: number;
  /** Extra deps that reset page and reload (filters). */
  filterKey?: string;
  debounceMs?: number;
  errorFallback?: string;
  initialQ?: string;
  initialPage?: number;
  /** Called after a successful fetch (e.g. tab counts from response). */
  onResponse?: (res: AdminPaginatedResponse<T>) => void;
};

/**
 * Пагинированный admin-list: debounce поиска, AbortController, page/total.
 */
export function useAdminPaginatedList<T>({
  buildPath,
  limit = 20,
  filterKey = '',
  debounceMs = 300,
  errorFallback = 'Не удалось загрузить',
  initialQ = '',
  initialPage = 1,
  onResponse,
}: UseAdminPaginatedListOptions<T>) {
  const [q, setQ] = useState(initialQ);
  const [qDebounced, setQDebounced] = useState(initialQ);
  const [page, setPage] = useState(Math.max(1, initialPage));
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [dataPage, setDataPage] = useState(Math.max(1, initialPage));
  const [dataLimit, setDataLimit] = useState(limit);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const skipNextQPageReset = useRef(true);
  const onResponseRef = useRef(onResponse);
  onResponseRef.current = onResponse;

  useEffect(() => {
    const t = setTimeout(() => {
      setQDebounced((prev) => {
        if (prev !== q) {
          if (skipNextQPageReset.current) {
            skipNextQPageReset.current = false;
          } else {
            setPage(1);
          }
        } else if (skipNextQPageReset.current) {
          skipNextQPageReset.current = false;
        }
        return q;
      });
    }, debounceMs);
    return () => clearTimeout(t);
  }, [q, debounceMs]);

  useEffect(() => {
    setPage(1);
  }, [filterKey]);

  const reload = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const requestId = ++requestIdRef.current;

    setError(null);
    setFetching(true);
    try {
      const path = buildPath({ page, limit, q: qDebounced.trim() });
      const res = await adminBackendJson<AdminPaginatedResponse<T>>(path, {
        signal: ac.signal,
      });
      if (requestId !== requestIdRef.current) return;
      setItems(res.items);
      setTotal(res.total);
      setDataPage(res.page);
      setDataLimit(res.limit);
      onResponseRef.current?.(res);
    } catch (e) {
      if (ac.signal.aborted) return;
      if (
        (e instanceof DOMException || e instanceof Error) &&
        e.name === 'AbortError'
      ) {
        return;
      }
      if (requestId !== requestIdRef.current) return;
      setError(e instanceof AdminBackendRequestError ? e.message : errorFallback);
      setItems([]);
      setTotal(0);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setFetching(false);
      }
    }
  }, [buildPath, errorFallback, limit, page, qDebounced]);

  useEffect(() => {
    void reload();
    return () => {
      abortRef.current?.abort();
    };
  }, [reload]);

  return {
    q,
    setQ,
    qDebounced,
    page,
    setPage,
    loading,
    fetching,
    error,
    items,
    setItems,
    total,
    dataPage,
    dataLimit,
    reload,
    searching: qDebounced.trim().length > 0,
  };
}
