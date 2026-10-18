'use client';

import { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { AdminCompactBtn, AdminCompactBtnLink } from '@/components/AdminCompactBtn/AdminCompactBtn';
import { AdminListShell } from '@/components/admin/AdminListShell/AdminListShell';
import {
  AdminSortableTable,
  DragHandleCell,
} from '@/components/admin/AdminSortableTable/AdminSortableTable';
import { AdminSearchBox } from '@/components/SearchBox/SearchBox';
import {
  AdminBackendRequestError,
  adminBackendJson,
} from '@/lib/adminBackendFetch';
import { useAdminResourceList } from '@/lib/useAdminResourceList';
import { revalidateCatalogStorefront } from '@/lib/revalidateCatalogStorefront';
import styles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';
import type { AdminCategory } from '@/lib/adminCatalogTypes';

function parentKey(parentId: string | null | undefined): string {
  return parentId ?? 'root';
}

function matchesQuery(c: AdminCategory, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [c.name, c.parent?.name ?? '', c.slug]
    .join(' ')
    .toLowerCase();
  return hay.includes(needle);
}

export function CategoriesListClient() {
  const [q, setQ] = useState('');

  const load = useCallback(
    () => adminBackendJson<AdminCategory[]>('catalog/admin/categories'),
    [],
  );

  const { items, setItems, loading, error, reload, remove } = useAdminResourceList<AdminCategory>({
    load,
    deleteUrl: (c) => `catalog/admin/categories/${c.id}`,
    confirmDelete: (c) => `Удалить категорию «${c.name}»?`,
    onAfterMutation: () => revalidateCatalogStorefront(),
  });

  const filtered = useMemo(
    () => items.filter((c) => matchesQuery(c, q)),
    [items, q],
  );

  const roots = useMemo(
    () =>
      filtered
        .filter((c) => !c.parentId)
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ru')),
    [filtered],
  );

  const children = useMemo(
    () =>
      filtered
        .filter((c) => c.parentId)
        .slice()
        .sort((a, b) => {
          const ap = a.parent?.name ?? '';
          const bp = b.parent?.name ?? '';
          const byParent = ap.localeCompare(bp, 'ru');
          if (byParent !== 0) return byParent;
          return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ru');
        }),
    [filtered],
  );

  const runReorder = useCallback(
    async (parentId: string | null, orderedIds: string[]) => {
      setItems((prev) => {
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
          body: JSON.stringify({ parentId, orderedIds }),
        });
        await revalidateCatalogStorefront();
      } catch (e) {
        alert(e instanceof AdminBackendRequestError ? e.message : 'Не удалось сохранить порядок');
        await reload();
      }
    },
    [reload, setItems],
  );

  const onChildrenDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const activeRow = children.find((r) => r.id === active.id);
      const overRow = children.find((r) => r.id === over.id);
      if (!activeRow || !overRow) return;
      if (parentKey(activeRow.parentId) !== parentKey(overRow.parentId)) return;
      const p = activeRow.parentId ?? null;
      const siblings = children.filter((r) => parentKey(r.parentId) === parentKey(p));
      const oldIndex = siblings.findIndex((r) => r.id === active.id);
      const newIndex = siblings.findIndex((r) => r.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      const next = arrayMove(siblings, oldIndex, newIndex);
      await runReorder(p, next.map((r) => r.id));
    },
    [children, runReorder],
  );

  function renderRow(c: AdminCategory, drag: Parameters<typeof DragHandleCell>[0], showParent: boolean) {
    return (
      <>
        <DragHandleCell {...drag} />
        <td>
          <Link href={`/admin/catalog/categories/${c.id}`}>{c.name}</Link>
        </td>
        {showParent ? <td>{c.parent?.name ?? '—'}</td> : null}
        <td>{c.productCount ?? 0}</td>
        <td>{c.childrenCount ?? 0}</td>
        <td className={styles.tableCellActions}>
          {(c.depthFromRoot ?? 0) < 2 ? (
            <AdminCompactBtnLink
              href={`/admin/catalog/categories/new?parentId=${c.id}`}
              variant="outline"
            >
              + Подкат.
            </AdminCompactBtnLink>
          ) : null}{' '}
          <AdminCompactBtn
            type="button"
            variant="danger"
            className={styles.iconDangerBtn}
            onClick={() => void remove(c)}
            aria-label={`Удалить категорию «${c.name}»`}
            title="Удалить"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10 11v6M14 11v6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </AdminCompactBtn>
        </td>
      </>
    );
  }

  const searching = q.trim().length > 0;

  return (
    <>
      <h1 className={styles.title}>Категории</h1>

      <AdminListShell
        loading={loading}
        error={error}
        onRetry={() => void reload()}
        loadingLabel="Загрузка…"
        empty={searching ? 'Ничего не найдено' : 'Категорий пока нет'}
        isEmpty={!loading && filtered.length === 0}
        wrapContent={false}
        toolbar={
          <div className={styles.toolbar}>
            <div className={styles.searchBoxToolbar}>
              <AdminSearchBox
                placeholder="Поиск категорий…"
                ariaLabel="Поиск категорий"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <AdminCompactBtnLink href="/admin/catalog/categories/new" variant="accent">
              Добавить корневую
            </AdminCompactBtnLink>
          </div>
        }
      >
        <section aria-labelledby="grp-root-cats">
          <h2 id="grp-root-cats" className={styles.groupHeading}>
            Корневые категории
          </h2>
          {roots.length === 0 ? (
            <p className={styles.muted}>
              {searching ? 'Нет совпадений среди корневых' : 'Корневых категорий пока нет'}
            </p>
          ) : (
            <AdminSortableTable
              ids={roots.map((r) => r.id)}
              onReorder={(orderedIds) => void runReorder(null, orderedIds)}
              head={
                <tr>
                  <th style={{ width: 36 }} aria-label="Порядок" />
                  <th>Название</th>
                  <th>Товары</th>
                  <th>Подкат.</th>
                  <th />
                </tr>
              }
              renderRow={(id, drag) => {
                const c = roots.find((x) => x.id === id)!;
                return renderRow(c, drag, false);
              }}
            />
          )}
        </section>

        {children.length > 0 ? (
          <section aria-labelledby="grp-subcats" style={{ marginTop: 32 }}>
            <h2 id="grp-subcats" className={styles.groupHeading}>
              Подкатегории
            </h2>
            <AdminSortableTable
              ids={children.map((r) => r.id)}
              onReorder={() => undefined}
              onDragEnd={onChildrenDragEnd}
              head={
                <tr>
                  <th style={{ width: 36 }} aria-label="Порядок" />
                  <th>Название</th>
                  <th>Родитель</th>
                  <th>Товары</th>
                  <th>Подкат.</th>
                  <th />
                </tr>
              }
              renderRow={(id, drag) => {
                const c = children.find((x) => x.id === id)!;
                return renderRow(c, drag, true);
              }}
            />
          </section>
        ) : null}
      </AdminListShell>
    </>
  );
}
