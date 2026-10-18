'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminCompactBtn } from '@/components/AdminCompactBtn/AdminCompactBtn';
import { AdminListPagination } from '@/components/admin/AdminListPagination/AdminListPagination';
import { AdminListShell } from '@/components/admin/AdminListShell/AdminListShell';
import { AdminSearchBox } from '@/components/SearchBox/SearchBox';
import { AdminSelect } from '@/components/AdminTextField/AdminTextField';
import {
  AdminBackendRequestError,
  adminBackendJson,
} from '@/lib/adminBackendFetch';
import { formatAdminDateTime, formatAdminMoney } from '@/lib/adminFormat';
import {
  GIFT_STATUS_LABEL_RU,
  maskGiftCodeDisplay,
  type AdminGiftCertificate,
  type AdminGiftCertificateListResponse,
  type AdminGiftDenomination,
  type GiftCertificateStatus,
} from '@/lib/adminGiftCertificateTypes';
import styles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';

const LIMIT = 20;

type StatusFilter = 'all' | GiftCertificateStatus;
type SourceFilter = 'all' | 'ADMIN' | 'PURCHASE';

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'ACTIVE', label: 'Активные' },
  { value: 'USED_UP', label: 'Израсходованы' },
  { value: 'EXPIRED', label: 'Истекшие' },
  { value: 'REVOKED', label: 'Отозванные' },
];

export function CertificateListClient() {
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [denominationId, setDenominationId] = useState('');
  const [denoms, setDenoms] = useState<AdminGiftDenomination[]>([]);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdminGiftCertificateListResponse | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setQDebounced(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    void (async () => {
      try {
        const rows = await adminBackendJson<AdminGiftDenomination[]>(
          'gift-certificates/admin/denominations',
        );
        setDenoms(Array.isArray(rows) ? rows : []);
      } catch {
        /* фильтр опционален */
      }
    })();
  }, []);

  const filtersActive = useMemo(
    () =>
      Boolean(qDebounced.trim()) ||
      statusFilter !== 'all' ||
      sourceFilter !== 'all' ||
      Boolean(denominationId),
    [qDebounced, statusFilter, sourceFilter, denominationId],
  );

  const resetFilters = useCallback(() => {
    setQ('');
    setQDebounced('');
    setStatusFilter('all');
    setSourceFilter('all');
    setDenominationId('');
    setPage(1);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    setFetching(true);
    try {
      const sp = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
      });
      if (qDebounced.trim()) sp.set('q', qDebounced.trim());
      if (statusFilter !== 'all') sp.set('status', statusFilter);
      if (sourceFilter !== 'all') sp.set('source', sourceFilter);
      if (denominationId) sp.set('denominationId', denominationId);
      const res = await adminBackendJson<AdminGiftCertificateListResponse>(
        `gift-certificates/admin?${sp}`,
      );
      setData(res);
      setRevealed({});
    } catch (e) {
      setError(e instanceof AdminBackendRequestError ? e.message : 'Не удалось загрузить');
      setData(null);
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }, [page, qDebounced, statusFilter, sourceFilter, denominationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function copyCode(id: string, code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* ignore */
    }
  }

  const items = data?.items ?? [];

  return (
    <AdminListShell
      loading={loading}
      error={error}
      onRetry={() => void load()}
      loadingLabel="Загрузка…"
      empty={
        filtersActive ? (
          <p className={styles.muted}>
            Ничего не найдено.{' '}
            <AdminCompactBtn type="button" variant="outline" onClick={resetFilters}>
              Сбросить фильтры
            </AdminCompactBtn>
          </p>
        ) : (
          'Сертификатов пока нет'
        )
      }
      isEmpty={!loading && items.length === 0}
      isFetching={fetching}
      wrapContent={false}
      toolbar={
        <div className={styles.toolbarFilters}>
          <div className={styles.searchBoxToolbar}>
            <AdminSearchBox
              ariaLabel="Поиск сертификатов"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Код, email…"
            />
          </div>
          <AdminSelect
            label="Статус"
            className={styles.toolbarFilter}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilter);
              setPage(1);
            }}
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </AdminSelect>
          <AdminSelect
            label="Источник"
            className={styles.toolbarFilter}
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value as SourceFilter);
              setPage(1);
            }}
          >
            <option value="all">Все источники</option>
            <option value="ADMIN">Админка</option>
            <option value="PURCHASE">Покупка</option>
          </AdminSelect>
          <AdminSelect
            label="Номинал"
            className={styles.toolbarFilter}
            value={denominationId}
            onChange={(e) => {
              setDenominationId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Все номиналы</option>
            {denoms.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({formatAdminMoney(d.faceValue)})
              </option>
            ))}
          </AdminSelect>
        </div>
      }
      pagination={
        data && data.total > LIMIT ? (
          <AdminListPagination
            page={page}
            total={data.total}
            limit={LIMIT}
            onPageChange={setPage}
          />
        ) : null
      }
    >
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Код</th>
                <th>Источник</th>
                <th>Номинал</th>
                <th>Остаток</th>
                <th>Статус</th>
                <th>Получатель</th>
                <th>Срок</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row: AdminGiftCertificate) => {
                const show = Boolean(revealed[row.id]);
                return (
                  <tr key={row.id}>
                    <td>
                      <div className={styles.codeCell}>
                        <Link href={`/admin/certificates/${row.id}`}>
                          <code>{show ? row.code : maskGiftCodeDisplay(row.code)}</code>
                        </Link>
                        <div className={styles.codeCellActions}>
                          <AdminCompactBtn
                            type="button"
                            onClick={() =>
                              setRevealed((prev) => ({
                                ...prev,
                                [row.id]: !prev[row.id],
                              }))
                            }
                          >
                            {show ? 'Скрыть' : 'Показать'}
                          </AdminCompactBtn>
                          <AdminCompactBtn
                            type="button"
                            onClick={() => void copyCode(row.id, row.code)}
                          >
                            {copiedId === row.id ? 'OK' : 'Копировать'}
                          </AdminCompactBtn>
                        </div>
                      </div>
                    </td>
                    <td>{row.source === 'PURCHASE' ? 'Покупка' : 'Админка'}</td>
                    <td>{formatAdminMoney(row.faceValue)}</td>
                    <td>{formatAdminMoney(row.balance)}</td>
                    <td>{GIFT_STATUS_LABEL_RU[row.status] ?? row.status}</td>
                    <td>{row.recipientEmail ?? '—'}</td>
                    <td>
                      {row.expiresAt ? formatAdminDateTime(row.expiresAt) : 'бессрочно'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </AdminListShell>
  );
}
