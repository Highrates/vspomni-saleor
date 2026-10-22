'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { toRelativeMediaPath } from '@vspomni/media-path';
import { AdminCompactBtn, AdminCompactBtnLink } from '@/components/AdminCompactBtn/AdminCompactBtn';
import { AdminListShell } from '@/components/admin/AdminListShell/AdminListShell';
import { AdminSearchBox } from '@/components/SearchBox/SearchBox';
import { adminBackendJson } from '@/lib/adminBackendFetch';
import { useAdminResourceList } from '@/lib/useAdminResourceList';
import styles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';
import type { AdminAromaNoteDefinition } from '@/lib/adminCatalogTypes';

function matchesQuery(d: AdminAromaNoteDefinition, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return d.name.toLowerCase().includes(needle);
}

export function AromaNoteDefinitionsListClient() {
  const [q, setQ] = useState('');

  const load = useCallback(
    () =>
      adminBackendJson<AdminAromaNoteDefinition[]>(
        'catalog/admin/aroma-note-definitions',
      ),
    [],
  );

  const { items, loading, error, reload, remove } =
    useAdminResourceList<AdminAromaNoteDefinition>({
      load,
      deleteUrl: (d) => `catalog/admin/aroma-note-definitions/${d.id}`,
      confirmDelete: (d) =>
        d.productCount
          ? `Нота «${d.name}» используется в ${d.productCount} товарах — удаление может быть отклонено. Продолжить?`
          : `Удалить ноту «${d.name}» из справочника?`,
    });

  const filtered = useMemo(
    () => items.filter((d) => matchesQuery(d, q)),
    [items, q],
  );
  const searching = q.trim().length > 0;

  return (
    <>
      <h1 className={styles.title}>Справочник нот пирамиды</h1>
      <p className={styles.cardNote}>
        Базовые / средние / верхние ноты на PDP. Не путать с «Ароматы» (теги зон).
        На товаре можно задать своё фото (override).
      </p>

      <AdminListShell
        loading={loading}
        error={error}
        onRetry={() => void reload()}
        loadingLabel="Загрузка…"
        empty={searching ? 'Ничего не найдено' : 'Справочник пуст'}
        isEmpty={!loading && filtered.length === 0}
        wrapContent={false}
        toolbar={
          <div className={styles.toolbar}>
            <div className={styles.searchBoxToolbar}>
              <AdminSearchBox
                placeholder="Поиск нот…"
                ariaLabel="Поиск нот"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <AdminCompactBtnLink
              href="/admin/catalog/aroma-note-definitions/new"
              variant="accent"
            >
              Добавить ноту
            </AdminCompactBtnLink>
          </div>
        }
      >
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: 56 }}>Фото</th>
              <th>Название</th>
              <th>Товары</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const src = toRelativeMediaPath(d.imageUrl) || d.imageUrl || '';
              return (
                <tr key={d.id}>
                  <td>
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={src}
                        alt=""
                        width={40}
                        height={40}
                        style={{
                          objectFit: 'cover',
                          borderRadius: 6,
                          display: 'block',
                        }}
                      />
                    ) : (
                      <span className={styles.mutedInline}>—</span>
                    )}
                  </td>
                  <td>
                    <Link href={`/admin/catalog/aroma-note-definitions/${d.id}`}>
                      {d.name}
                    </Link>
                  </td>
                  <td>{d.productCount ?? 0}</td>
                  <td className={styles.tableCellActions}>
                    <AdminCompactBtn
                      type="button"
                      variant="danger"
                      onClick={() => void remove(d)}
                    >
                      Удалить
                    </AdminCompactBtn>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </AdminListShell>
    </>
  );
}
