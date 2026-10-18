'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminCompactBtn, AdminCompactBtnLink } from '@/components/AdminCompactBtn/AdminCompactBtn';
import { AdminTextArea, AdminTextField } from '@/components/AdminTextField/AdminTextField';
import { useToast } from '@/components/Toast/ToastProvider';
import {
  AdminBackendRequestError,
  adminBackendJson,
} from '@/lib/adminBackendFetch';
import catalogStyles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';
import pn from '@/app/(admin)/admin/catalog/products/productNew.module.css';
import styles from '../Settings.module.css';

type SiteSeoApi = {
  id: string;
  siteUrl: string | null;
  titleSuffix: string;
  defaultMetaDescription: string | null;
  defaultOgImageUrl: string | null;
  homeMetaTitle: string | null;
  homeMetaDescription: string | null;
  homeOgImageUrl: string | null;
  updatedAt: string | null;
};

export function SiteSeoAdminClient() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [loadedOk, setLoadedOk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [siteUrl, setSiteUrl] = useState('');
  const [titleSuffix, setTitleSuffix] = useState('Vspomni');
  const [defaultMetaDescription, setDefaultMetaDescription] = useState('');
  const [defaultOgImageUrl, setDefaultOgImageUrl] = useState('');
  const [homeMetaTitle, setHomeMetaTitle] = useState('');
  const [homeMetaDescription, setHomeMetaDescription] = useState('');
  const [homeOgImageUrl, setHomeOgImageUrl] = useState('');

  const applyData = useCallback((data: SiteSeoApi) => {
    setSiteUrl(data.siteUrl?.trim() || '');
    setTitleSuffix(data.titleSuffix?.trim() || 'Vspomni');
    setDefaultMetaDescription(data.defaultMetaDescription ?? '');
    setDefaultOgImageUrl(data.defaultOgImageUrl ?? '');
    setHomeMetaTitle(data.homeMetaTitle ?? '');
    setHomeMetaDescription(data.homeMetaDescription ?? '');
    setHomeOgImageUrl(data.homeOgImageUrl ?? '');
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setLoadedOk(false);
    try {
      const data = await adminBackendJson<SiteSeoApi>('settings/admin/seo');
      applyData(data);
      setLoadedOk(true);
      setDirty(false);
    } catch (e) {
      setLoadedOk(false);
      setLoadError(e instanceof AdminBackendRequestError ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [applyData]);

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

  function markDirty() {
    setDirty(true);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!loadedOk || saving || !dirty) return;
    setSaving(true);
    setLoadError(null);
    try {
      const data = await adminBackendJson<SiteSeoApi>('settings/admin/seo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl: siteUrl.trim() || null,
          titleSuffix: titleSuffix.trim() || 'Vspomni',
          defaultMetaDescription: defaultMetaDescription.trim() || null,
          defaultOgImageUrl: defaultOgImageUrl.trim() || null,
          homeMetaTitle: homeMetaTitle.trim() || null,
          homeMetaDescription: homeMetaDescription.trim() || null,
          homeOgImageUrl: homeOgImageUrl.trim() || null,
        }),
      });
      applyData(data);
      setDirty(false);
      showToast('Сохранено');
    } catch (err) {
      showToast(err instanceof AdminBackendRequestError ? err.message : 'Ошибка сохранения');
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
            {dirty ? <span className={pn.dirtyHintInline}>Несохранённые изменения</span> : null}
          </div>
          <h1 className={pn.stickyToolbarTitle}>SEO</h1>
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
          <section className={styles.faqCard}>
            <h2 className={pn.placementHeading}>Сайт</h2>
            <p className={pn.placementHint}>
              Базовые значения для title, description и Open Graph на витрине.
            </p>
            <AdminTextField
              label="URL сайта"
              value={siteUrl}
              onChange={(e) => {
                markDirty();
                setSiteUrl(e.target.value);
              }}
              placeholder="https://vspomni.store"
              disabled={saving}
            />
            <AdminTextField
              label="Суффикс title"
              value={titleSuffix}
              onChange={(e) => {
                markDirty();
                setTitleSuffix(e.target.value);
              }}
              placeholder="Vspomni"
              disabled={saving}
            />
            <AdminTextArea
              label="Description по умолчанию"
              value={defaultMetaDescription}
              onChange={(e) => {
                markDirty();
                setDefaultMetaDescription(e.target.value);
              }}
              rows={3}
              maxLength={5000}
              disabled={saving}
            />
            <AdminTextField
              label="OG-картинка по умолчанию"
              value={defaultOgImageUrl}
              onChange={(e) => {
                markDirty();
                setDefaultOgImageUrl(e.target.value);
              }}
              placeholder="/uploads/…"
              disabled={saving}
            />
          </section>

          <section className={styles.faqCard}>
            <h2 className={pn.placementHeading}>Главная</h2>
            <p className={pn.placementHint}>
              Переопределяют глобальные значения только для главной страницы.
            </p>
            <AdminTextField
              label="Title главной"
              value={homeMetaTitle}
              onChange={(e) => {
                markDirty();
                setHomeMetaTitle(e.target.value);
              }}
              maxLength={120}
              disabled={saving}
            />
            <AdminTextArea
              label="Description главной"
              value={homeMetaDescription}
              onChange={(e) => {
                markDirty();
                setHomeMetaDescription(e.target.value);
              }}
              rows={3}
              maxLength={5000}
              disabled={saving}
            />
            <AdminTextField
              label="OG-картинка главной"
              value={homeOgImageUrl}
              onChange={(e) => {
                markDirty();
                setHomeOgImageUrl(e.target.value);
              }}
              placeholder="/uploads/…"
              disabled={saving}
            />
          </section>
        </div>
      )}
    </form>
  );
}
