import { OrderStatus, Prisma } from '@prisma/client';

/** Москва без DST — границы суток для дашборда. */
const MOSCOW_OFFSET = '+03:00';

/** Заказы/выручка/ср. чек — только оплаченные и дальше по воронке. */
export const DASHBOARD_REVENUE_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.PACKING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

export type DashboardPeriodKind =
  | 'today'
  | 'yesterday'
  | 'last_7'
  | 'week'
  | 'month'
  | 'custom';

export type DashboardPeriodRange = {
  kind: DashboardPeriodKind;
  from: Date;
  to: Date;
  fromDate: string;
  toDate: string;
};

/** YYYY-MM-DD в Europe/Moscow. */
export function moscowDateString(d = new Date()): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' });
}

function parseYmd(ymd: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || day < 1 || day > 31) return null;
  return { y, m: mo, d: day };
}

/** Начало суток YYYY-MM-DD (Москва) → Date UTC. */
export function moscowDayStart(ymd: string): Date | null {
  const p = parseYmd(ymd);
  if (!p) return null;
  const iso = `${String(p.y).padStart(4, '0')}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}T00:00:00${MOSCOW_OFFSET}`;
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Конец суток (exclusive = начало следующего дня в Москве). */
export function moscowDayEndExclusive(ymd: string): Date | null {
  const p = parseYmd(ymd);
  if (!p) return null;
  const next = new Date(Date.UTC(p.y, p.m - 1, p.d + 1));
  const ny = next.getUTCFullYear();
  const nm = next.getUTCMonth() + 1;
  const nd = next.getUTCDate();
  return moscowDayStart(
    `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`,
  );
}

/** Сдвиг календарной даты YYYY-MM-DD на `deltaDays` (UTC-арифметика по Y-M-D). */
export function shiftYmd(ymd: string, deltaDays: number): string | null {
  const p = parseYmd(ymd);
  if (!p) return null;
  const next = new Date(Date.UTC(p.y, p.m - 1, p.d + deltaDays));
  const ny = next.getUTCFullYear();
  const nm = next.getUTCMonth() + 1;
  const nd = next.getUTCDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

/** Понедельник календарной недели (пн–вс) для YYYY-MM-DD в Москве. */
export function mondayOfWeekYmd(ymd: string): string | null {
  const start = moscowDayStart(ymd);
  if (!start) return null;
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Moscow',
    weekday: 'short',
  }).format(start);
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const offset = map[weekday] ?? 0;
  return shiftYmd(ymd, -offset);
}

const PERIOD_KINDS = new Set<DashboardPeriodKind>([
  'today',
  'yesterday',
  'last_7',
  'week',
  'month',
  'custom',
]);

export function resolveDashboardPeriod(opts: {
  period?: string;
  from?: string;
  to?: string;
}): DashboardPeriodRange {
  const kindRaw = (opts.period ?? 'today').trim().toLowerCase();
  const kind: DashboardPeriodKind = PERIOD_KINDS.has(kindRaw as DashboardPeriodKind)
    ? (kindRaw as DashboardPeriodKind)
    : 'today';

  if (kind === 'custom') {
    const fromDate = opts.from?.trim() || moscowDateString();
    const toDate = opts.to?.trim() || fromDate;
    const from = moscowDayStart(fromDate);
    const toEx = moscowDayEndExclusive(toDate);
    if (!from || !toEx) {
      throw new Error('Некорректный период: from/to в формате YYYY-MM-DD');
    }
    if (from.getTime() >= toEx.getTime()) {
      throw new Error('Дата «с» должна быть не позже «по»');
    }
    return { kind, from, to: toEx, fromDate, toDate };
  }

  const today = moscowDateString();

  if (kind === 'yesterday') {
    const fromDate = shiftYmd(today, -1)!;
    const from = moscowDayStart(fromDate)!;
    const to = moscowDayEndExclusive(fromDate)!;
    return { kind, from, to, fromDate, toDate: fromDate };
  }

  if (kind === 'last_7') {
    const fromDate = shiftYmd(today, -6)!;
    const from = moscowDayStart(fromDate)!;
    const to = moscowDayEndExclusive(today)!;
    return { kind, from, to, fromDate, toDate: today };
  }

  if (kind === 'week') {
    const fromDate = mondayOfWeekYmd(today)!;
    const from = moscowDayStart(fromDate)!;
    const to = moscowDayEndExclusive(today)!;
    return { kind, from, to, fromDate, toDate: today };
  }

  if (kind === 'month') {
    const fromDate = `${today.slice(0, 7)}-01`;
    const from = moscowDayStart(fromDate)!;
    const to = moscowDayEndExclusive(today)!;
    return { kind, from, to, fromDate, toDate: today };
  }

  const from = moscowDayStart(today)!;
  const to = moscowDayEndExclusive(today)!;
  return { kind: 'today', from, to, fromDate: today, toDate: today };
}

export function orderSalesWhere(from: Date, to: Date): Prisma.OrderWhereInput {
  return {
    createdAt: { gte: from, lt: to },
    status: { in: DASHBOARD_REVENUE_STATUSES },
  };
}
