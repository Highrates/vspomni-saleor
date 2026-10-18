'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { AdminCompactBtn, AdminCompactBtnLink } from '@/components/AdminCompactBtn/AdminCompactBtn';
import { AdminListShell } from '@/components/admin/AdminListShell/AdminListShell';
import {
  AdminSortableTable,
  DragHandleCell,
} from '@/components/admin/AdminSortableTable/AdminSortableTable';
import { AdminSearchBox } from '@/components/SearchBox/SearchBox';
import { adminBackendJson } from '@/lib/adminBackendFetch';
import { useAdminResourceList } from '@/lib/useAdminResourceList';
import { revalidateCatalogStorefront } from '@/lib/revalidateCatalogStorefront';
import styles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';
import type { AdminCatalogTag } from '@/lib/adminCatalogTypes';

function matchesQuery(t: AdminCatalogTag, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [t.name, t.slug].join(' ').toLowerCase().includes(needle);
}

export function CatalogTagsListClient() {
  const [q, setQ] = useState('');

  const load = useCallback(
    () => adminBackendJson<AdminCatalogTag[]>('catalog/admin/catalog-tags'),
    [],
  );

  const { items, loading, error, reload, remove, reorder } = useAdminResourceList<AdminCatalogTag>({
    load,
    deleteUrl: (t) => `catalog/admin/catalog-tags/${t.id}`,
    confirmDelete: (t) => `Удалить тег «${t.name}»?`,
    reorderUrl: 'catalog/admin/catalog-tags/reorder',
    onAfterMutation: () => revalidateCatalogStorefront(),
  });

  const filtered = useMemo(() => items.filter((t) => matchesQuery(t, q)), [items, q]);
  const searching = q.trim().length > 0;

  return (
    <>
      <h1 className={styles.title}>Ароматы</h1>

      <AdminListShell
        loading={loading}
        error={error}
        onRetry={() => void reload()}
        loadingLabel="Загрузка…"
        empty={searching ? 'Ничего не найдено' : 'Тегов пока нет'}
        isEmpty={!loading && filtered.length === 0}
        wrapContent={false}
        toolbar={
          <div className={styles.toolbar}>
            <div className={styles.searchBoxToolbar}>
              <AdminSearchBox
                placeholder="Поиск тегов…"
                ariaLabel="Поиск тегов"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <AdminCompactBtnLink href="/admin/catalog/tags/new" variant="accent">
              Добавить тег
            </AdminCompactBtnLink>
          </div>
        }
      >
        <AdminSortableTable
          ids={filtered.map((t) => t.id)}
          onReorder={searching ? () => undefined : reorder}
          head={
            <tr>
              <th style={{ width: 36 }} aria-label="Порядок" />
              <th>Название</th>
              <th>Slug</th>
              <th>Товары</th>
              <th />
            </tr>
          }
          renderRow={(id, drag) => {
            const t = filtered.find((x) => x.id === id)!;
            return (
              <>
                <DragHandleCell {...drag} />
                <td>
                  <Link href={`/admin/catalog/tags/${t.id}`}>{t.name}</Link>
                </td>
                <td className={styles.mutedInline}>{t.slug}</td>
                <td>{t.productCount ?? 0}</td>
                <td className={styles.tableCellActions}>
                  <AdminCompactBtn type="button" variant="danger" onClick={() => void remove(t)}>
                    Удалить
                  </AdminCompactBtn>
                </td>
              </>
            );
          }}
        />
      </AdminListShell>
    </>
  );
}
