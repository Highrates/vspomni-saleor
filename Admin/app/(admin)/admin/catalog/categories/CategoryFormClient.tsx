'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdminCompactBtn, AdminCompactBtnLink } from '@/components/AdminCompactBtn/AdminCompactBtn';
import {
  AdminSortableTable,
  DragHandleCell,
} from '@/components/admin/AdminSortableTable/AdminSortableTable';
import { AdminTabs } from '@/components/AdminTabs/AdminTabs';
import { AdminTextField } from '@/components/AdminTextField/AdminTextField';
import {
  AdminBackendRequestError,
  adminBackendFetch,
  adminBackendJson,
  readAdminApiError,
} from '@/lib/adminBackendFetch';
import type {
  AdminCategory,
  AdminProductListItem,
  AdminProductListResponse,
} from '@/lib/adminCatalogTypes';
import { revalidateCatalogStorefront } from '@/lib/revalidateCatalogStorefront';
import styles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';

type TabId = 'subcategories' | 'products';

export function CategoryFormClient({ categoryId }: { categoryId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parentIdFromQuery = searchParams.get('parentId');
  const isEdit = Boolean(categoryId);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [parentName, setParentName] = useState<string | null>(null);
  const [canAddChild, setCanAddChild] = useState(false);
  const [childrenCount, setChildrenCount] = useState(0);
  const [productCount, setProductCount] = useState(0);

  const [tab, setTab] = useState<TabId>('products');
  const [allCategories, setAllCategories] = useState<AdminCategory[]>([]);
  const [products, setProducts] = useState<AdminProductListItem[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  const loadCategory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (categoryId) {
        const c = await adminBackendJson<AdminCategory>(
          `catalog/admin/categories/${categoryId}`,
        );
        setName(c.name);
        setSlug(c.slug);
        setCoverImageUrl(c.coverImageUrl ?? null);
        setParentId(c.parentId);
        setParentName(c.parent?.name ?? null);
        setCanAddChild((c.depthFromRoot ?? 0) < 2);
        setChildrenCount(c.childrenCount ?? 0);
        setProductCount(c.productCount ?? 0);
        setTab((c.childrenCount ?? 0) > 0 ? 'subcategories' : 'products');
      } else if (parentIdFromQuery) {
        const parent = await adminBackendJson<AdminCategory>(
          `catalog/admin/categories/${parentIdFromQuery}`,
        );
        if ((parent.depthFromRoot ?? 0) >= 2) {
          throw new Error('Нельзя создать подкатегорию глубже третьего уровня');
        }
        setParentId(parent.id);
        setParentName(parent.name);
      } else {
        setParentId(null);
        setParentName(null);
      }
    } catch (e) {
      setError(
        e instanceof AdminBackendRequestError || e instanceof Error ? e.message : 'Ошибка',
      );
    } finally {
      setLoading(false);
    }
  }, [categoryId, parentIdFromQuery]);

  useEffect(() => {
    void loadCategory();
  }, [loadCategory]);

  const loadTabsData = useCallback(async () => {
    if (!categoryId) return;
    setTabLoading(true);
    try {
      const [cats, prodRes] = await Promise.all([
        adminBackendJson<AdminCategory[]>('catalog/admin/categories'),
        adminBackendJson<AdminProductListResponse>(
          `catalog/admin/products?categoryId=${encodeURIComponent(categoryId)}&limit=100`,
        ),
      ]);
      setAllCategories(cats);
      setProducts(prodRes.items);
      setProductCount(prodRes.total);
      setChildrenCount(cats.filter((c) => c.parentId === categoryId).length);
    } catch (e) {
      setError(
        e instanceof AdminBackendRequestError || e instanceof Error
          ? e.message
          : 'Не удалось загрузить вкладки',
      );
    } finally {
      setTabLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    if (isEdit) void loadTabsData();
  }, [isEdit, loadTabsData]);

  const childCategories = useMemo(
    () =>
      allCategories
        .filter((c) => c.parentId === categoryId)
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ru')),
    [allCategories, categoryId],
  );

  const runChildReorder = useCallback(
    async (orderedIds: string[]) => {
      if (!categoryId) return;
      setAllCategories((prev) => {
        const next = [...prev];
        orderedIds.forEach((id, sortOrder) => {
          const i = next.findIndex((x) => x.id === id);
          if (i >= 0) next[i] = { ...next[i], sortOrder };
        });
        return next;
      });
      try {
        await adminBackendJson('catalog/admin/categories/reorder', {
          method: 'POST',
          body: JSON.stringify({ parentId: categoryId, orderedIds }),
        });
        await revalidateCatalogStorefront();
      } catch (e) {
        alert(
          e instanceof AdminBackendRequestError ? e.message : 'Не удалось сохранить порядок',
        );
        await loadTabsData();
      }
    },
    [categoryId, loadTabsData],
  );

  async function onCoverFile(file: File | null) {
    if (!file) return;
    setUploadingCover(true);
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
      if (!json.url) throw new Error('Сервер не вернул URL обложки');
      setCoverImageUrl(json.url);
    } catch (e) {
      setError(
        e instanceof AdminBackendRequestError || e instanceof Error
          ? e.message
          : 'Не удалось загрузить обложку',
      );
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (!name.trim()) throw new Error('Укажите название');

      if (!isEdit) {
        const created = await adminBackendJson<AdminCategory>('catalog/admin/categories', {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            parentId,
            coverImageUrl,
          }),
        });
        await revalidateCatalogStorefront({ cat: created.slug });
        router.replace(`/admin/catalog/categories/${created.id}`);
        router.refresh();
        return;
      }

      const updated = await adminBackendJson<AdminCategory>(
        `catalog/admin/categories/${categoryId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: name.trim(),
            coverImageUrl,
          }),
        },
      );
      setSlug(updated.slug);
      setCoverImageUrl(updated.coverImageUrl ?? null);
      await revalidateCatalogStorefront({ cat: updated.slug });
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

  const tabItems: { id: TabId; label: string }[] = [];
  if (isEdit && (childrenCount > 0 || childCategories.length > 0)) {
    tabItems.push({
      id: 'subcategories',
      label: `Подкатегории (${childCategories.length || childrenCount})`,
    });
  }
  if (isEdit) {
    tabItems.push({
      id: 'products',
      label: `Товары (${productCount})`,
    });
  }

  return (
    <form onSubmit={(e) => void onSave(e)} className={styles.formFull}>
      <div className={styles.formNarrow}>
      <p className={styles.backRow}>
        <AdminCompactBtnLink href="/admin/catalog/categories" variant="outline">
          ← К списку
        </AdminCompactBtnLink>
      </p>
      <div className={styles.detailTitleRow}>
        <h1 className={styles.title}>
          {isEdit ? 'Категория' : parentId ? 'Новая подкатегория' : 'Новая категория'}
        </h1>
        <div className={styles.detailTitleActions}>
          {isEdit && canAddChild && categoryId ? (
            <AdminCompactBtnLink
              href={`/admin/catalog/categories/new?parentId=${categoryId}`}
              variant="outline"
            >
              + Подкатегория
            </AdminCompactBtnLink>
          ) : null}
          <AdminCompactBtn type="submit" variant="accent" disabled={saving || uploadingCover}>
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </AdminCompactBtn>
        </div>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {parentName ? <p className={styles.cardNote}>Родитель: {parentName}</p> : null}

      <AdminTextField
        label="Название"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      {isEdit ? (
        <p className={styles.cardNote}>Slug: {slug} (из названия)</p>
      ) : (
        <p className={styles.cardNote}>Slug сгенерируется автоматически из названия</p>
      )}

      <div className={styles.coverBlock}>
        <p className={styles.coverLabel}>Обложка</p>
        {coverImageUrl ? (
          <div className={styles.coverPreviewWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.coverPreview} src={coverImageUrl} alt="" />
            <button
              type="button"
              className={styles.coverRemoveBtn}
              onClick={() => setCoverImageUrl(null)}
              disabled={uploadingCover}
              aria-label="Убрать обложку"
              title="Убрать"
            >
              ×
            </button>
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
          onChange={(e) => void onCoverFile(e.target.files?.[0] ?? null)}
        />
        {uploadingCover ? <p className={styles.muted}>Загрузка…</p> : null}
      </div>
      </div>

      {isEdit && tabItems.length > 0 ? (
        <>
          <AdminTabs
            ariaLabel="Разделы категории"
            variant="underline"
            activeId={tab}
            onChange={(id) => setTab(id as TabId)}
            items={tabItems}
          />

          {tabLoading ? <p className={styles.muted}>Загрузка…</p> : null}

          {!tabLoading && tab === 'subcategories' ? (
            childCategories.length === 0 ? (
              <p className={styles.muted}>Подкатегорий нет</p>
            ) : (
              <AdminSortableTable
                ids={childCategories.map((c) => c.id)}
                onReorder={(orderedIds) => void runChildReorder(orderedIds)}
                head={
                  <tr>
                    <th style={{ width: 36 }} aria-label="Порядок" />
                    <th>Название</th>
                    <th>Товары</th>
                    <th>Подкат.</th>
                  </tr>
                }
                renderRow={(id, drag) => {
                  const c = childCategories.find((x) => x.id === id)!;
                  return (
                    <>
                      <DragHandleCell {...drag} />
                      <td>
                        <Link href={`/admin/catalog/categories/${c.id}`}>{c.name}</Link>
                      </td>
                      <td>{c.productCount ?? 0}</td>
                      <td>{c.childrenCount ?? 0}</td>
                    </>
                  );
                }}
              />
            )
          ) : null}

          {!tabLoading && tab === 'products' ? (
            products.length === 0 ? (
              <p className={styles.muted}>В этой категории пока нет товаров</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ width: 56 }} />
                      <th>Название</th>
                      <th>Варианты</th>
                      <th>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                        <tr key={p.id}>
                          <td>
                            {p.coverImageUrl && p.coverMediaType !== 'video' ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={p.coverImageUrl}
                                alt=""
                                className={styles.productListThumb}
                              />
                            ) : (
                              <span className={styles.muted}>—</span>
                            )}
                          </td>
                          <td>
                            <Link href={`/admin/catalog/products/${p.id}`}>{p.name}</Link>
                          </td>
                          <td>{p.variantCount}</td>
                          <td>{p.active ? 'В каталоге' : 'Скрыт'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}
        </>
      ) : null}
    </form>
  );
}
