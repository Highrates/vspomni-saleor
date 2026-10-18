'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminCompactBtn, AdminCompactBtnLink } from '@/components/AdminCompactBtn/AdminCompactBtn';
import { AdminTextArea } from '@/components/AdminTextField/AdminTextField';
import { useToast } from '@/components/Toast/ToastProvider';
import {
  AdminBackendRequestError,
  adminBackendJson,
} from '@/lib/adminBackendFetch';
import { DiscountProductPickerModal } from '@/app/(admin)/admin/discounts/DiscountScopePickerModal';
import catalogStyles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';
import pn from '@/app/(admin)/admin/catalog/products/productNew.module.css';
import styles from '../Settings.module.css';

type MenuApi = {
  id?: string;
  productId: string | null;
  annotationText: string;
  product: { id: string; name: string; slug: string } | null;
  updatedAt?: string | null;
};

export function MenuAdminClient() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [loadedOk, setLoadedOk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [productId, setProductId] = useState('');
  const [productName, setProductName] = useState('');
  const [annotationText, setAnnotationText] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setLoadedOk(false);
    try {
      const data = await adminBackendJson<MenuApi>('settings/admin/menu');
      setProductId(data.productId?.trim() || '');
      setProductName(data.product?.name?.trim() || '');
      setAnnotationText(data.annotationText ?? '');
      setLoadedOk(true);
      setDirty(false);
    } catch (e) {
      setLoadedOk(false);
      setLoadError(
        e instanceof AdminBackendRequestError ? e.message : 'Ошибка загрузки',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!loadedOk || saving || !dirty) return;
    setSaving(true);
    setLoadError(null);
    try {
      const data = await adminBackendJson<MenuApi>('settings/admin/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: productId.trim() || null,
          annotationText: annotationText.trim(),
        }),
      });
      setProductId(data.productId?.trim() || '');
      setProductName(data.product?.name?.trim() || '');
      setAnnotationText(data.annotationText ?? '');
      setDirty(false);
      showToast('Сохранено');
    } catch (err) {
      showToast(
        err instanceof AdminBackendRequestError ? err.message : 'Ошибка сохранения',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className={catalogStyles.lead}>Загрузка…</p>;
  }

  const canSave = loadedOk && dirty && !saving;

  return (
    <form
      onSubmit={(e) => void onSave(e)}
      className={`${catalogStyles.form} ${catalogStyles.formWide}`}
    >
      <div className={pn.stickyToolbar}>
        <div className={pn.stickyToolbarMain}>
          <div className={pn.stickyToolbarNav}>
            <AdminCompactBtnLink href="/admin/settings" variant="outline">
              ← Настройки
            </AdminCompactBtnLink>
            {dirty ? (
              <span className={pn.dirtyHintInline}>Несохранённые изменения</span>
            ) : null}
          </div>
          <h1 className={pn.stickyToolbarTitle}>Меню</h1>
        </div>
        <div className={pn.stickyToolbarActions}>
          <AdminCompactBtn type="submit" variant="accent" disabled={!canSave}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </AdminCompactBtn>
        </div>
      </div>

      {loadError ? (
        <div className={catalogStyles.errorBanner} role="alert">
          <span>{loadError}</span>
          <AdminCompactBtn type="button" variant="outline" onClick={() => void load()}>
            Повторить
          </AdminCompactBtn>
          <button
            type="button"
            className={catalogStyles.errorBannerDismiss}
            onClick={() => setLoadError(null)}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
      ) : null}

      {!loadedOk ? (
        <p className={catalogStyles.lead}>Не удалось загрузить. Сохранение отключено.</p>
      ) : (
        <div className={`${pn.productFormMain} ${styles.menuFormStack}`}>
          <AdminTextArea
            label="Текст"
            value={annotationText}
            onChange={(e) => {
              setAnnotationText(e.target.value);
              setDirty(true);
            }}
            maxLength={2000}
            rows={3}
            disabled={saving}
          />

          <div>
            <p className={pn.placementHeading}>Товар</p>
            <p className={`${catalogStyles.mutedInline} ${styles.menuProductMeta}`}>
              {productId ? productName || productId : 'Не выбран'}
            </p>
            <div className={styles.menuProductActions}>
              <AdminCompactBtn
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setPickerOpen(true)}
              >
                {productId ? 'Сменить' : 'Выбрать'}
              </AdminCompactBtn>
              {productId ? (
                <AdminCompactBtn
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => {
                    setProductId('');
                    setProductName('');
                    setDirty(true);
                  }}
                >
                  Очистить
                </AdminCompactBtn>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <DiscountProductPickerModal
        open={pickerOpen}
        single
        selectedIds={productId ? [productId] : []}
        selectedLabels={productId && productName ? { [productId]: productName } : {}}
        onClose={() => setPickerOpen(false)}
        onApply={(ids, labels) => {
          const id = ids[0] ?? '';
          setProductId(id);
          setProductName(id ? labels[id] || '' : '');
          setDirty(true);
          setPickerOpen(false);
        }}
      />
    </form>
  );
}
