'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AdminCompactBtn, AdminCompactBtnLink } from '@/components/AdminCompactBtn/AdminCompactBtn';
import { AdminListPagination } from '@/components/admin/AdminListPagination/AdminListPagination';
import { AdminListShell } from '@/components/admin/AdminListShell/AdminListShell';
import { AdminSearchBox } from '@/components/SearchBox/SearchBox';
import { AdminTabs } from '@/components/AdminTabs/AdminTabs';
import {
  AdminBackendRequestError,
  adminBackendJson,
} from '@/lib/adminBackendFetch';
import { adminConfirmDelete } from '@/lib/adminConfirmDelete';
import { formatAdminDateTime } from '@/lib/adminFormat';
import { DISCOUNT_STATUS_LABELS, discountStatusBadgeClass } from '@/lib/adminDiscountTypes';
import type {
  AdminDiscountListResponse,
  DiscountScope,
} from '@/lib/adminDiscountTypes';
import styles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';

const LIMIT = 20;

type ScopeFilter = 'all' | DiscountScope;

function scopeLabel(scope: string): string {
  return scope === 'CATEGORY' ? 'Категории' : 'Товары';
}

function formatRange(startsAt: string, endsAt: string | null): string {
  const from = formatAdminDateTime(startsAt);
  if (!endsAt) return `с ${from}`;
  return `${from} — ${formatAdminDateTime(endsAt)}`;
}

export function DiscountsListClient() {
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdminDiscountListResponse | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setQDebounced(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setError(null);
    setFetching(true);
    try {
      const sp = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
      });
      if (qDebounced.trim()) sp.set('q', qDebounced.trim());
      if (scopeFilter !== 'all') sp.set('scope', scopeFilter);
      const res = await adminBackendJson<AdminDiscountListResponse>(`discounts/admin?${sp}`);
      setData(res);
    } catch (e) {
      setError(e instanceof AdminBackendRequestError ? e.message : 'Не удалось загрузить');
      setData(null);
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }, [page, qDebounced, scopeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: string, name: string) {
    const ok = await adminConfirmDelete({
      message: `Удалить скидку «${name}»?`,
      url: `discounts/admin/${id}`,
      onDone: load,
    });
    void ok;
  }

  const items = data?.items ?? [];

  return (
    <>
      <h1 className={styles.title}>Скидки</h1>

      <AdminTabs
        ariaLabel="Фильтр по области"
        variant="underline"
        compact
        activeId={scopeFilter}
        onChange={(id) => {
          setScopeFilter(id as ScopeFilter);
          setPage(1);
        }}
        items={[
          { id: 'all', label: 'Все' },
          { id: 'CATEGORY', label: 'Категории' },
          { id: 'PRODUCTS', label: 'Товары' },
        ]}
      />

      <AdminListShell
        loading={loading}
        error={error}
        onRetry={() => void load()}
        loadingLabel="Загрузка…"
        empty="Скидок пока нет"
        isEmpty={!loading && items.length === 0}
        isFetching={fetching}
        toolbar={
          <div className={styles.toolbar}>
            <div className={styles.searchBoxToolbar}>
              <AdminSearchBox
                placeholder="Поиск"
                ariaLabel="Поиск скидок"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <AdminCompactBtnLink href="/admin/discounts/new" variant="accent">
              Добавить
            </AdminCompactBtnLink>
          </div>
        }
        pagination={
          data ? (
            <AdminListPagination
              page={data.page}
              total={data.total}
              limit={data.limit}
              onPageChange={setPage}
              disabled={fetching}
            />
          ) : null
        }
      >
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Название</th>
              <th>Область</th>
              <th>Период</th>
              <th>Правила</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr
                key={row.id}
                className={
                  row.status === 'OFF' || row.status === 'EXPIRED'
                    ? styles.rowInactive
                    : undefined
                }
              >
                <td>
                  <Link href={`/admin/discounts/${row.id}`}>{row.name}</Link>
                </td>
                <td>{scopeLabel(row.scope)}</td>
                <td className={styles.mutedInline}>{formatRange(row.startsAt, row.endsAt)}</td>
                <td>{row.ruleCount}</td>
                <td>
                  <span
                    className={`${styles.badge} ${discountStatusBadgeClass(row.status, styles)}`}
                  >
                    {DISCOUNT_STATUS_LABELS[row.status]}
                  </span>
                </td>
                <td className={styles.tableCellActions}>
                  <AdminCompactBtn
                    type="button"
                    variant="danger"
                    onClick={() => void remove(row.id, row.name)}
                  >
                    Удалить
                  </AdminCompactBtn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminListShell>
    </>
  );
}
