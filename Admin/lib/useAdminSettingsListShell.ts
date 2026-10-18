'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminBackendRequestError } from '@/lib/adminBackendFetch';

/**
 * Общий каркас редакторов settings-list (FAQ / Hero / Sets):
 * loadedOk, dirty + beforeunload, loadError (retry) vs actionError (dismiss).
 */
export function useAdminSettingsListShell() {
  const [loading, setLoading] = useState(true);
  const [loadedOk, setLoadedOk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const markDirty = useCallback(() => setDirty(true), []);
  const clearDirty = useCallback(() => setDirty(false), []);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const beginLoad = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    setActionError(null);
    setLoadedOk(false);
  }, []);

  const succeedLoad = useCallback(() => {
    setLoadedOk(true);
    setDirty(false);
    setLoading(false);
  }, []);

  const failLoad = useCallback((e: unknown, fallback = 'Ошибка загрузки') => {
    setLoadedOk(false);
    setLoadError(e instanceof AdminBackendRequestError ? e.message : fallback);
    setLoading(false);
  }, []);

  const beginSave = useCallback(() => {
    setSaving(true);
    setActionError(null);
  }, []);

  const succeedSave = useCallback(() => {
    setDirty(false);
    setSaving(false);
  }, []);

  const failSave = useCallback((e: unknown, fallback = 'Ошибка сохранения') => {
    const msg = e instanceof AdminBackendRequestError ? e.message : fallback;
    setActionError(msg);
    setSaving(false);
    return msg;
  }, []);

  const failAction = useCallback((e: unknown, fallback = 'Ошибка') => {
    const msg = e instanceof Error ? e.message : fallback;
    setActionError(msg);
    return msg;
  }, []);

  return {
    loading,
    loadedOk,
    saving,
    dirty,
    loadError,
    actionError,
    setLoadError,
    setActionError,
    markDirty,
    clearDirty,
    beginLoad,
    succeedLoad,
    failLoad,
    beginSave,
    succeedSave,
    failSave,
    failAction,
    setSaving,
  };
}
