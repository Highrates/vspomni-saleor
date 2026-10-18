'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminCompactBtn } from '@/components/AdminCompactBtn/AdminCompactBtn';
import { AdminListShell } from '@/components/admin/AdminListShell/AdminListShell';
import {
  AdminBackendRequestError,
  adminBackendJson,
} from '@/lib/adminBackendFetch';
import type {
  DashboardOverview,
  DashboardPeriodKind,
} from '@/lib/adminDashboardTypes';
import { formatAdminMoney } from '@/lib/adminFormat';
import catalogStyles from '@/app/(admin)/admin/catalog/catalogAdmin.module.css';
import styles from './dashboard.module.css';
import dateStyles from '@/components/admin/AdminDateField/AdminDateField.module.css';

function todayYmd(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' });
}

function monthStartYmd(): string {
  return `${todayYmd().slice(0, 7)}-01`;
}

/** YYYY-MM-DD → ДД.ММ.ГГГГ */
function formatYmdRu(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  if (!y || !m || !d) return ymd;
  return `${d}.${m}.${y}`;
}

function formatPeriodRange(fromDate: string, toDate: string): string {
  if (fromDate === toDate) return formatYmdRu(fromDate);
  return `${formatYmdRu(fromDate)} – ${formatYmdRu(toDate)}`;
}

type Insight = { icon: string; text: string };

/** Эвристики по KPI — блок «Подсказки» на дашборде (без LLM). */
function buildAssistantInsights(
  data: DashboardOverview | null,
  loading: boolean,
): Insight[] {
  if (loading) return [];
  if (!data) {
    return [{ icon: '⚠️', text: 'Не удалось загрузить сводку — обновите период или повторите.' }];
  }

  const items: Insight[] = [];
  const { ordersCount, revenue, averageCheck, newClientsCount, topProducts, period } =
    data;
  const periodLabel =
    period.kind === 'today'
      ? 'сегодня'
      : period.kind === 'month'
        ? 'в этом месяце'
        : `за ${formatPeriodRange(period.fromDate, period.toDate)}`;

  if (ordersCount === 0) {
    items.push({
      icon: '🔔',
      text: `Пока нет оплаченных заказов ${periodLabel}. Проверьте воронку и наличие активных акций.`,
    });
  } else if (ordersCount < 3 && period.kind === 'today') {
    items.push({
      icon: '📉',
      text: `Сегодня мало заказов (${ordersCount}). Имеет смысл сверить трафик и топ товаров.`,
    });
  } else {
    items.push({
      icon: '✅',
      text: `${ordersCount} заказ(ов) ${periodLabel}, выручка ${formatAdminMoney(revenue)}.`,
    });
  }

  if (ordersCount > 0 && averageCheck > 0 && averageCheck < 3000) {
    items.push({
      icon: '💡',
      text: `Средний чек ${formatAdminMoney(averageCheck)} — можно подсветить наборы и upsell в корзине.`,
    });
  } else if (ordersCount > 0 && averageCheck >= 8000) {
    items.push({
      icon: '✨',
      text: `Сильный средний чек ${formatAdminMoney(averageCheck)}. Зафиксируйте, какие SKU тянут корзину.`,
    });
  }

  if (newClientsCount === 0 && ordersCount > 0) {
    items.push({
      icon: '👤',
      text: 'Новых клиентов за период нет — продажи идут по базе. Смотрите повторные покупки.',
    });
  } else if (newClientsCount >= 5) {
    items.push({
      icon: '🌱',
      text: `${newClientsCount} новых клиентов ${periodLabel}. Хороший момент проверить онбординг и welcome-оффер.`,
    });
  }

  const top = topProducts[0];
  if (top) {
    items.push({
      icon: '🏆',
      text: `Лидер: «${top.productName}» — ${top.qty} шт., ${formatAdminMoney(top.revenue)}.`,
    });
  } else if (ordersCount === 0) {
    items.push({
      icon: '📦',
      text: 'Топ продаж пуст. Откройте каталог и проверьте наличие и цены.',
    });
  }

  return items.slice(0, 4);
}

export function DashboardClient() {
  const [period, setPeriod] = useState<DashboardPeriodKind>('today');
  const [draftFrom, setDraftFrom] = useState(monthStartYmd);
  const [draftTo, setDraftTo] = useState(todayYmd);
  const [appliedFrom, setAppliedFrom] = useState(monthStartYmd);
  const [appliedTo, setAppliedTo] = useState(todayYmd);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardOverview | null>(null);

  const query = useMemo(() => {
    const sp = new URLSearchParams({ period });
    if (period === 'custom') {
      sp.set('from', appliedFrom);
      sp.set('to', appliedTo);
    }
    return sp.toString();
  }, [period, appliedFrom, appliedTo]);

  const load = useCallback(async () => {
    setError(null);
    setFetching(true);
    try {
      const res = await adminBackendJson<DashboardOverview>(
        `dashboard/admin/overview?${query}`,
      );
      setData(res);
    } catch (e) {
      setData(null);
      setError(e instanceof AdminBackendRequestError ? e.message : 'Не удалось загрузить');
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  const [insightsCollapsed, setInsightsCollapsed] = useState(false);
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
  const periodMenuRef = useRef<HTMLDivElement>(null);
  const customPending =
    draftFrom !== appliedFrom || draftTo !== appliedTo;

  function selectPreset(next: 'today' | 'month') {
    setPeriod(next);
    setPeriodMenuOpen(false);
  }

  function openPeriodMenu() {
    setDraftFrom(appliedFrom);
    setDraftTo(appliedTo);
    setPeriodMenuOpen(true);
  }

  function applyCustomRange() {
    if (!draftFrom || !draftTo) return;
    setAppliedFrom(draftFrom);
    setAppliedTo(draftTo);
    setPeriod('custom');
    setPeriodMenuOpen(false);
  }

  useEffect(() => {
    if (!periodMenuOpen) return;
    const onPointer = (e: MouseEvent) => {
      const el = periodMenuRef.current;
      if (el && !el.contains(e.target as Node)) setPeriodMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPeriodMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [periodMenuOpen]);

  const customChipLabel =
    period === 'custom'
      ? formatPeriodRange(appliedFrom, appliedTo)
      : 'Период';

  const top = data?.topProducts ?? [];
  const insights = useMemo(
    () => buildAssistantInsights(data, loading),
    [data, loading],
  );

  return (
    <>
      <h1 className={catalogStyles.title}>Дашборд</h1>

      <section aria-label="Сводка">
        <div className={styles.periodBar}>
          <div
            className={styles.periodChips}
            role="radiogroup"
            aria-label="Период сводки"
          >
            <AdminCompactBtn
              type="button"
              role="radio"
              aria-checked={period === 'today'}
              variant={period === 'today' ? 'accent' : 'outline'}
              onClick={() => selectPreset('today')}
            >
              Сегодня
            </AdminCompactBtn>
            <AdminCompactBtn
              type="button"
              role="radio"
              aria-checked={period === 'month'}
              variant={period === 'month' ? 'accent' : 'outline'}
              onClick={() => selectPreset('month')}
            >
              Этот месяц
            </AdminCompactBtn>

            <div className={styles.periodChipWrap} ref={periodMenuRef}>
              <AdminCompactBtn
                type="button"
                role="radio"
                aria-checked={period === 'custom'}
                aria-expanded={periodMenuOpen}
                aria-haspopup="dialog"
                variant={period === 'custom' ? 'accent' : 'outline'}
                onClick={() => {
                  if (periodMenuOpen) setPeriodMenuOpen(false);
                  else openPeriodMenu();
                }}
              >
                {customChipLabel}
              </AdminCompactBtn>

              {periodMenuOpen ? (
                <div
                  className={styles.periodPopover}
                  role="dialog"
                  aria-label="Выбор периода"
                >
                  <label className={styles.periodDateField}>
                    <span className={dateStyles.dateLabel}>С</span>
                    <input
                      className={styles.periodDateInput}
                      type="date"
                      value={draftFrom}
                      max={draftTo}
                      onChange={(e) => setDraftFrom(e.target.value)}
                    />
                  </label>
                  <label className={styles.periodDateField}>
                    <span className={dateStyles.dateLabel}>По</span>
                    <input
                      className={styles.periodDateInput}
                      type="date"
                      value={draftTo}
                      min={draftFrom}
                      max={todayYmd()}
                      onChange={(e) => setDraftTo(e.target.value)}
                    />
                  </label>
                  <div className={styles.periodPopoverActions}>
                    <AdminCompactBtn
                      type="button"
                      variant="outline"
                      onClick={() => setPeriodMenuOpen(false)}
                    >
                      Отмена
                    </AdminCompactBtn>
                    <AdminCompactBtn
                      type="button"
                      variant="accent"
                      disabled={
                        !draftFrom ||
                        !draftTo ||
                        (!customPending && period === 'custom') ||
                        fetching
                      }
                      onClick={applyCustomRange}
                    >
                      Применить
                    </AdminCompactBtn>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {error ? (
          <p className={catalogStyles.error} role="alert">
            {error}{' '}
            <AdminCompactBtn type="button" variant="outline" onClick={() => void load()}>
              Повторить
            </AdminCompactBtn>
          </p>
        ) : null}

        <div
          className={`${styles.summaryRow} ${
            insightsCollapsed ? styles.summaryRowCollapsed : ''
          }`}
        >
          <div className={styles.kpiGrid} aria-busy={loading || fetching}>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>📦 Заказов</p>
              <p className={styles.kpiValue}>
                {loading ? '…' : data ? String(data.ordersCount) : '—'}
              </p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>💰 Выручка</p>
              <p className={styles.kpiValue}>
                {loading ? '…' : data ? formatAdminMoney(data.revenue) : '—'}
              </p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>🧾 Ср. чек</p>
              <p className={styles.kpiValue}>
                {loading ? '…' : data ? formatAdminMoney(data.averageCheck) : '—'}
              </p>
            </div>
            <Link
              href="/admin/users"
              className={`${styles.kpi} ${styles.kpiClickable}`}
              title="Открыть пользователей"
            >
              <p className={styles.kpiLabel}>👤 Новые клиенты</p>
              <p className={styles.kpiValue}>
                {loading ? '…' : data ? String(data.newClientsCount) : '—'}
              </p>
            </Link>
          </div>

          <aside
            className={`${styles.insightsPanel} ${
              insightsCollapsed ? styles.insightsPanelCollapsed : ''
            }`}
            aria-label="Подсказки"
          >
            {insightsCollapsed ? (
              <button
                type="button"
                className={`${styles.insightsToggle} ${styles.insightsExpandHit}`}
                aria-expanded={false}
                aria-label="Развернуть подсказки"
                onClick={() => setInsightsCollapsed(false)}
              >
                <span className={styles.insightsCollapsedLabel}>
                  Подсказки
                </span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path
                    d="M9 2L5 7L9 12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            ) : (
              <>
                <div className={styles.insightsHead}>
                  <p className={styles.insightsTitle}>
                    Подсказки
                  </p>
                  <button
                    type="button"
                    className={styles.insightsToggle}
                    aria-expanded
                    aria-label="Свернуть подсказки"
                    onClick={() => setInsightsCollapsed(true)}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                      <path
                        d="M5 2L9 7L5 12"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
                {loading ? (
                  <p className={styles.insightMuted}>Считаю подсказки…</p>
                ) : insights.length === 0 ? (
                  <p className={styles.insightMuted}>
                    Пока нет подсказок за выбранный период.
                  </p>
                ) : (
                  <ul className={styles.insightsList}>
                    {insights.map((item) => (
                      <li key={item.text} className={styles.insightItem}>
                        <span className={styles.insightIcon} aria-hidden>
                          {item.icon}
                        </span>
                        <p className={styles.insightText}>{item.text}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </aside>
        </div>
      </section>

      <section aria-labelledby="dash-top">
        <h2 id="dash-top" className={styles.sectionTitle}>
          🏆 Топ продаж
        </h2>
        <AdminListShell
          loading={loading}
          error={null}
          loadingLabel="Загрузка…"
          empty="Пока нет продаж за выбранный период"
          isEmpty={!loading && !error && top.length === 0}
          isFetching={fetching}
          wrapContent
        >
          <table className={catalogStyles.table}>
            <thead>
              <tr>
                <th style={{ width: 48 }} aria-label="Фото" />
                <th>Товар</th>
                <th>SKU</th>
                <th>Кол-во</th>
                <th>Выручка</th>
              </tr>
            </thead>
            <tbody>
              {top.map((row) => (
                <tr key={`${row.sku ?? ''}:${row.productName}`}>
                  <td>
                    {row.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className={styles.topThumb} src={row.imageUrl} alt="" />
                    ) : (
                      <span className={styles.topThumbPh} aria-hidden />
                    )}
                  </td>
                  <td>
                    {row.productId ? (
                      <Link href={`/admin/catalog/products/${row.productId}`}>
                        {row.productName}
                        {row.variantName && row.variantName !== row.productName
                          ? ` — ${row.variantName}`
                          : ''}
                      </Link>
                    ) : (
                      row.productName
                    )}
                  </td>
                  <td className={catalogStyles.mutedInline}>{row.sku ?? '—'}</td>
                  <td>{row.qty}</td>
                  <td>{formatAdminMoney(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminListShell>
      </section>
    </>
  );
}
