'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AdminCompactBtn, AdminCompactBtnLink } from '@/components/AdminCompactBtn/AdminCompactBtn';
import { AdminListShell } from '@/components/admin/AdminListShell/AdminListShell';
import {
  AdminSortableTable,
  DragHandleCell,
} from '@/components/admin/AdminSortableTable/AdminSortableTable';
import { AdminSearchBox } from '@/components/SearchBox/SearchBox';
import type { AdminProductGroup } from '@/lib/adminCatalogTypes';
import { adminBackendListAllPages } from '@/lib/adminListAll';
import { useAdminResourceList } from '@/lib/useAdminResourceList';
import { revalidateCatalogStorefront } from '@/lib/revalidateCatalogStorefront';
import styles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';

export type CatalogProductGroupKind = 'collections' | 'product-sets';

const CONFIG: Record<
  CatalogProductGroupKind,
  {
    title: string;
    empty: string;
    searchAria: string;
    activeLabel: string;
    inactiveLabel: string;
    entityLabel: string;
    apiBase: string;
    listHref: string;
    newHref: string;
    detailHref: (id: string) => string;
  }
> = {
  collections: {
    title: 'Коллекции',
    empty: 'Коллекций пока нет',
    searchAria: 'Поиск коллекций',
    activeLabel: 'Активна',
    inactiveLabel: 'Скрыта',
    entityLabel: 'коллекцию',
    apiBase: 'catalog/admin/collections',
    listHref: '/admin/collections',
    newHref: '/admin/collections/new',
    detailHref: (id) => `/admin/collections/${id}`,
  },
  'product-sets': {
    title: 'Наборы',
    empty: 'Наборов пока нет',
    searchAria: 'Поиск наборов',
    activeLabel: 'Активен',
    inactiveLabel: 'Скрыт',
    entityLabel: 'набор',
    apiBase: 'catalog/admin/product-sets',
    listHref: '/admin/product-sets',
    newHref: '/admin/product-sets/new',
    detailHref: (id) => `/admin/product-sets/${id}`,
  },
};

export function CatalogProductGroupListClient({ kind }: { kind: CatalogProductGroupKind }) {
  const cfg = CONFIG[kind];
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(
    () =>
      adminBackendListAllPages<AdminProductGroup>(cfg.apiBase, {
        q: qDebounced.trim() || undefined,
      }),
    [cfg.apiBase, qDebounced],
  );

  const { items, loading, fetching, error, reload, remove, reorder } =
    useAdminResourceList<AdminProductGroup>({
      load,
      deleteUrl: (row) => `${cfg.apiBase}/${row.id}`,
      confirmDelete: (row) => `Удалить ${cfg.entityLabel} «${row.name}»?`,
      reorderUrl: `${cfg.apiBase}/reorder`,
      onAfterMutation: () => revalidateCatalogStorefront(),
    });

  const canDrag = !qDebounced.trim();

  return (
    <>
      <h1 className={styles.title}>{cfg.title}</h1>

      <AdminListShell
        loading={loading}
        error={error}
        onRetry={() => void reload()}
        loadingLabel="Загрузка…"
        empty={cfg.empty}
        isEmpty={!loading && items.length === 0}
        isFetching={fetching}
        wrapContent={!canDrag}
        toolbar={
          <div className={styles.toolbar}>
            <div className={styles.searchBoxToolbar}>
              <AdminSearchBox
                placeholder="Поиск"
                ariaLabel={cfg.searchAria}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <AdminCompactBtnLink href={cfg.newHref} variant="accent">
              Добавить
            </AdminCompactBtnLink>
          </div>
        }
      >
        {canDrag ? (
          <AdminSortableTable
            ids={items.map((t) => t.id)}
            onReorder={reorder}
            head={
              <tr>
                <th style={{ width: 36 }} aria-label="Порядок" />
                <th>Название</th>
                <th>Slug</th>
                <th>Товаров</th>
                <th>Статус</th>
                <th />
              </tr>
            }
            renderRow={(id, drag) => {
              const row = items.find((x) => x.id === id)!;
              return (
                <>
                  <DragHandleCell {...drag} />
                  <td>
                    <Link href={cfg.detailHref(row.id)}>{row.name}</Link>
                  </td>
                  <td className={styles.mutedInline}>{row.slug}</td>
                  <td>{row.itemCount}</td>
                  <td>{row.active ? cfg.activeLabel : cfg.inactiveLabel}</td>
                  <td className={styles.tableCellActions}>
                    <AdminCompactBtn type="button" variant="danger" onClick={() => void remove(row)}>
                      Удалить
                    </AdminCompactBtn>
                  </td>
                </>
              );
            }}
          />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Название</th>
                <th>Slug</th>
                <th>Товаров</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link href={cfg.detailHref(row.id)}>{row.name}</Link>
                  </td>
                  <td className={styles.mutedInline}>{row.slug}</td>
                  <td>{row.itemCount}</td>
                  <td>{row.active ? cfg.activeLabel : cfg.inactiveLabel}</td>
                  <td className={styles.tableCellActions}>
                    <AdminCompactBtn type="button" variant="danger" onClick={() => void remove(row)}>
                      Удалить
                    </AdminCompactBtn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AdminListShell>
    </>
  );
}
