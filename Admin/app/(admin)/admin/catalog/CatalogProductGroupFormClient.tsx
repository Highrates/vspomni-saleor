'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminCheckbox } from '@/components/admin/AdminCheckbox/AdminCheckbox';
import { AdminCompactBtn, AdminCompactBtnLink } from '@/components/AdminCompactBtn/AdminCompactBtn';
import { AdminTextArea, AdminTextField } from '@/components/AdminTextField/AdminTextField';
import {
  AdminBackendRequestError,
  adminBackendFetch,
  adminBackendJson,
  readAdminApiError,
} from '@/lib/adminBackendFetch';
import type { AdminProductGroup } from '@/lib/adminCatalogTypes';
import { revalidateCatalogStorefront } from '@/lib/revalidateCatalogStorefront';
import styles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';
import { ProductIdsPicker } from './ProductIdsPicker';
import type { CatalogProductGroupKind } from './CatalogProductGroupListClient';

const CONFIG: Record<
  CatalogProductGroupKind,
  {
    editTitle: string;
    newTitle: string;
    activeCheckbox: string;
    activeCheckboxId: string;
    apiBase: string;
    listHref: string;
  }
> = {
  collections: {
    editTitle: 'Коллекция',
    newTitle: 'Новая коллекция',
    activeCheckbox: 'Активна',
    activeCheckboxId: 'collection-active',
    apiBase: 'catalog/admin/collections',
    listHref: '/admin/collections',
  },
  'product-sets': {
    editTitle: 'Набор',
    newTitle: 'Новый набор',
    activeCheckbox: 'Активен',
    activeCheckboxId: 'product-set-active',
    apiBase: 'catalog/admin/product-sets',
    listHref: '/admin/product-sets',
  },
};

export function CatalogProductGroupFormClient({
  kind,
  id,
}: {
  kind: CatalogProductGroupKind;
  id?: string;
}) {
  const cfg = CONFIG[kind];
  const router = useRouter();
  const isEdit = Boolean(id);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const productPreviewInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingProductPreview, setUploadingProductPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [productPreviewUrl, setProductPreviewUrl] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const [featuredLayout, setFeaturedLayout] = useState(false);
  const [productIds, setProductIds] = useState<string[]>([]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const row = await adminBackendJson<AdminProductGroup>(`${cfg.apiBase}/${id}`);
        if (cancelled) return;
        setName(row.name);
        setSlug(row.slug);
        setShortDescription(row.shortDescription ?? '');
        setCoverImageUrl(row.coverImageUrl ?? null);
        setProductPreviewUrl(row.productPreviewUrl ?? null);
        setActive(row.active);
        setFeaturedLayout(row.featuredLayout ?? false);
        setProductIds(row.productIds ?? []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof AdminBackendRequestError ? e.message : 'Ошибка загрузки');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cfg.apiBase, id]);

  async function uploadImage(
    file: File | null,
    opts: {
      setUploading: (v: boolean) => void;
      setUrl: (url: string) => void;
      inputRef: React.RefObject<HTMLInputElement | null>;
      failLabel: string;
    },
  ) {
    if (!file) return;
    opts.setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await adminBackendFetch('catalog/admin/upload-rich-media?type=image', {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) throw new AdminBackendRequestError(await readAdminApiError(res), res.status);
      const json = (await res.json()) as { url?: string };
      if (!json.url) throw new Error('Сервер не вернул URL');
      opts.setUrl(json.url);
    } catch (e) {
      setError(
        e instanceof AdminBackendRequestError || e instanceof Error
          ? e.message
          : opts.failLabel,
      );
    } finally {
      opts.setUploading(false);
      if (opts.inputRef.current) opts.inputRef.current.value = '';
    }
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (!name.trim()) throw new Error('Укажите название');
      const body = {
        name: name.trim(),
        slug: slug.trim() || undefined,
        shortDescription: shortDescription.trim() || null,
        coverImageUrl,
        active,
        ...(kind === 'collections'
          ? {
              featuredLayout,
              productPreviewUrl: featuredLayout ? productPreviewUrl : null,
            }
          : {}),
        productIds,
      };

      if (!isEdit) {
        await adminBackendJson<AdminProductGroup>(cfg.apiBase, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        await revalidateCatalogStorefront();
        router.replace(cfg.listHref);
        router.refresh();
        return;
      }

      await adminBackendJson<AdminProductGroup>(`${cfg.apiBase}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      await revalidateCatalogStorefront();
      router.replace(cfg.listHref);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof AdminBackendRequestError || err instanceof Error
          ? err.message
          : 'Не удалось сохранить',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className={styles.muted}>Загрузка…</p>;
  }

  const uploading = uploadingCover || uploadingProductPreview;

  return (
    <form onSubmit={(e) => void onSave(e)} className={`${styles.form} ${styles.formWide}`}>
      <p className={styles.backRow}>
        <AdminCompactBtnLink href={cfg.listHref} variant="outline">
          ← К списку
        </AdminCompactBtnLink>
      </p>
      <div className={styles.detailTitleRow}>
        <h1 className={styles.title}>{isEdit ? cfg.editTitle : cfg.newTitle}</h1>
        <div className={styles.detailTitleActions}>
          <AdminCompactBtn type="submit" variant="accent" disabled={saving || uploading}>
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </AdminCompactBtn>
        </div>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <AdminTextField
        label="Название"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <AdminTextField
        label="Slug"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        placeholder={isEdit ? undefined : 'пусто → авто'}
      />
      <AdminTextArea
        label="Короткое описание"
        value={shortDescription}
        onChange={(e) => setShortDescription(e.target.value)}
        rows={3}
      />

      <div className={styles.coverBlock}>
        <p className={styles.coverLabel}>Обложка</p>
        {coverImageUrl ? (
          <div className={styles.coverPreviewRow}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.coverPreview} src={coverImageUrl} alt="" />
            <AdminCompactBtn
              type="button"
              variant="outline"
              onClick={() => setCoverImageUrl(null)}
              disabled={uploadingCover}
            >
              Убрать
            </AdminCompactBtn>
          </div>
        ) : (
          <p className={styles.muted}>Не выбрана</p>
        )}
        <input
          ref={coverInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className={styles.coverFileInput}
          disabled={uploadingCover}
          onChange={(e) =>
            void uploadImage(e.target.files?.[0] ?? null, {
              setUploading: setUploadingCover,
              setUrl: setCoverImageUrl,
              inputRef: coverInputRef,
              failLabel: 'Не удалось загрузить обложку',
            })
          }
        />
        {uploadingCover ? <p className={styles.muted}>Загрузка…</p> : null}
      </div>

      <div className={styles.labelCheckboxRow}>
        <AdminCheckbox
          id={cfg.activeCheckboxId}
          className={styles.adminCheckboxForm}
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          aria-label={cfg.activeCheckbox}
        />
        <label htmlFor={cfg.activeCheckboxId}>{cfg.activeCheckbox}</label>
      </div>

      {kind === 'collections' ? (
        <>
          <div className={styles.labelCheckboxRow}>
            <AdminCheckbox
              id="collection-featured-layout"
              className={styles.adminCheckboxForm}
              checked={featuredLayout}
              onChange={(e) => setFeaturedLayout(e.target.checked)}
              aria-label="FeaturedCollections на главной"
            />
            <label htmlFor="collection-featured-layout">
              FeaturedCollections на главной (lifestyle + обложка). Выкл. — сетка
              товаров Recommendations
            </label>
          </div>

          {featuredLayout ? (
            <div className={styles.coverBlock}>
              <p className={styles.coverLabel}>Фото товара (левая колонка Featured)</p>
              {productPreviewUrl ? (
                <div className={styles.coverPreviewRow}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className={styles.coverPreview} src={productPreviewUrl} alt="" />
                  <AdminCompactBtn
                    type="button"
                    variant="outline"
                    onClick={() => setProductPreviewUrl(null)}
                    disabled={uploadingProductPreview}
                  >
                    Убрать
                  </AdminCompactBtn>
                </div>
              ) : (
                <p className={styles.muted}>
                  Не выбрано — на витрине возьмётся фото первого товара в коллекции
                </p>
              )}
              <input
                ref={productPreviewInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className={styles.coverFileInput}
                disabled={uploadingProductPreview}
                onChange={(e) =>
                  void uploadImage(e.target.files?.[0] ?? null, {
                    setUploading: setUploadingProductPreview,
                    setUrl: setProductPreviewUrl,
                    inputRef: productPreviewInputRef,
                    failLabel: 'Не удалось загрузить фото товара',
                  })
                }
              />
              {uploadingProductPreview ? <p className={styles.muted}>Загрузка…</p> : null}
            </div>
          ) : null}
        </>
      ) : null}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Товары</h2>
        <p className={styles.muted}>
          Добавьте товары через модальное окно. Порядок в списке (drag) = порядок на
          главной и в{' '}
          <code>/catalog?collection=…</code>. Чтобы показать коллекцию на главной:
          включите «Активна», добавьте товары и сохраните. Опционально — «Блок Featured».
        </p>
        <ProductIdsPicker value={productIds} onChange={setProductIds} />
      </section>
    </form>
  );
}
