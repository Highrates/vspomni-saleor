'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AdminBackendRequestError,
  adminBackendJson,
} from '@/lib/adminBackendFetch';
import { adminConfirmDelete } from '@/lib/adminConfirmDelete';

type IdRow = { id: string; sortOrder?: number };

export type UseAdminResourceListOptions<T extends IdRow> = {
  /** Загрузка полного списка (или отфильтрованного). */
  load: () => Promise<T[]>;
  /** DELETE path для строки. */
  deleteUrl: (item: T) => string;
  /** Текст confirm перед удалением. */
  confirmDelete: (item: T) => string;
  /** POST reorder endpoint; body по умолчанию `{ orderedIds }`. */
  reorderUrl?: string;
  /** Кастомное тело reorder (например categories с parentId). */
  buildReorderBody?: (orderedIds: string[]) => unknown;
  errorFallback?: string;
  /** После успешного delete/reorder (например ISR витрины). */
  onAfterMutation?: () => void | Promise<void>;
};

/**
 * Общий load / delete-confirm / reorder / alert для admin list clients.
 */
export function useAdminResourceList<T extends IdRow>(opts: UseAdminResourceListOptions<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    load: loadFn,
    deleteUrl,
    confirmDelete,
    reorderUrl,
    buildReorderBody,
    errorFallback = 'Не удалось загрузить',
    onAfterMutation,
  } = opts;

  const reload = useCallback(async () => {
    setError(null);
    setFetching(true);
    try {
      const rows = await loadFn();
      setItems(rows);
    } catch (e) {
      setError(e instanceof AdminBackendRequestError ? e.message : errorFallback);
      setItems([]);
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }, [loadFn, errorFallback]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const remove = useCallback(
    async (item: T) => {
      await adminConfirmDelete({
        message: confirmDelete(item),
        url: deleteUrl(item),
        onDone: async () => {
          await reload();
          await onAfterMutation?.();
        },
      });
    },
    [confirmDelete, deleteUrl, reload, onAfterMutation],
  );

  const reorder = useCallback(
    async (orderedIds: string[]) => {
      if (!reorderUrl) return;
      setItems((prev) => {
        const byId = new Map(prev.map((row) => [row.id, row]));
        return orderedIds.map((id, sortOrder) => ({
          ...byId.get(id)!,
          sortOrder,
        }));
      });
      try {
        const body = buildReorderBody
          ? buildReorderBody(orderedIds)
          : { orderedIds };
        await adminBackendJson(reorderUrl, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        await onAfterMutation?.();
      } catch (e) {
        alert(e instanceof AdminBackendRequestError ? e.message : 'Не удалось сохранить порядок');
        await reload();
      }
    },
    [reorderUrl, buildReorderBody, reload, onAfterMutation],
  );

  return {
    items,
    setItems,
    loading,
    fetching,
    isFetching: fetching,
    error,
    reload,
    remove,
    reorder,
  };
}
