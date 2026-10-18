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
import {
  formatPromoReward,
  type AdminPromoCode,
  type AdminPromoListResponse,
} from '@/lib/adminPromoTypes';
import styles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';

const LIMIT = 20;

type ActiveFilter = 'all' | '1' | '0';

export function PromoListClient() {
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdminPromoListResponse | null>(null);

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
      if (activeFilter !== 'all') sp.set('active', activeFilter);
      const res = await adminBackendJson<AdminPromoListResponse>(`promo/admin?${sp}`);
      setData(res);
    } catch (e) {
      setError(e instanceof AdminBackendRequestError ? e.message : 'Не удалось загрузить');
      setData(null);
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }, [page, qDebounced, activeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(row: AdminPromoCode) {
    await adminConfirmDelete({
      message: `Удалить промокод «${row.code}»? Если уже есть применения — код только выключится, история сохранится.`,
      url: `promo/admin/${row.id}`,
      onDone: load,
    });
  }

  const items = data?.items ?? [];

  return (
    <>
      <h1 className={styles.title}>Промокоды</h1>

      <AdminTabs
        ariaLabel="Фильтр по статусу"
        variant="underline"
        compact
        activeId={activeFilter}
        onChange={(id) => {
          setActiveFilter(id as ActiveFilter);
          setPage(1);
        }}
        items={[
          { id: 'all', label: 'Все' },
          { id: '1', label: 'Активные' },
          { id: '0', label: 'Выкл.' },
        ]}
      />

      <AdminListShell
        loading={loading}
        error={error}
        onRetry={() => void load()}
        loadingLabel="Загрузка…"
        empty="Промокодов пока нет"
        isEmpty={!loading && items.length === 0}
        wrapContent={false}
        toolbar={
          <div className={styles.toolbar}>
            <div className={styles.searchBoxToolbar}>
              <AdminSearchBox
                ariaLabel="Поиск промокодов"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Код…"
              />
            </div>
            <AdminCompactBtnLink href="/admin/promo/new" variant="accent">
              Новый промокод
            </AdminCompactBtnLink>
          </div>
        }
      >
        {fetching && !loading ? <p className={styles.muted}>Обновление…</p> : null}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Код</th>
                <th>Скидка</th>
                <th>Лимиты</th>
                <th>Исп.</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link href={`/admin/promo/${row.id}`}>{row.code}</Link>
                  </td>
                  <td>{formatPromoReward(row.type, row.value)}</td>
                  <td className={styles.mutedInline}>
                    {[
                      row.oneShot ? '1×' : null,
                      row.maxUses != null ? `max ${row.maxUses}` : null,
                      row.minOrderAmount != null ? `от ${row.minOrderAmount}₽` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </td>
                  <td className={styles.mutedInline}>{row.usedCount ?? 0}</td>
                  <td className={styles.mutedInline}>{row.active ? 'Активен' : 'Выкл.'}</td>
                  <td className={styles.tableCellActions}>
                    <AdminCompactBtn
                      type="button"
                      variant="danger"
                      onClick={() => void remove(row)}
                    >
                      Удалить
                    </AdminCompactBtn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(data?.total ?? 0) > LIMIT ? (
          <AdminListPagination
            page={page}
            total={data!.total}
            limit={LIMIT}
            onPageChange={setPage}
          />
        ) : null}
      </AdminListShell>
    </>
  );
}
