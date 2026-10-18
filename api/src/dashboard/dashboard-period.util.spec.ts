import { describe, expect, it } from 'vitest';
import {
  moscowDateString,
  moscowDayStart,
  resolveDashboardPeriod,
} from './dashboard-period.util';

describe('dashboard-period.util', () => {
  it('today даёт границы одних суток Москвы', () => {
    const r = resolveDashboardPeriod({ period: 'today' });
    expect(r.kind).toBe('today');
    expect(r.fromDate).toBe(moscowDateString());
    expect(r.to.getTime()).toBeGreaterThan(r.from.getTime());
  });

  it('month начинается с 1-го числа', () => {
    const r = resolveDashboardPeriod({ period: 'month' });
    expect(r.kind).toBe('month');
    expect(r.fromDate.endsWith('-01')).toBe(true);
  });

  it('custom парсит from/to', () => {
    const r = resolveDashboardPeriod({
      period: 'custom',
      from: '2026-07-01',
      to: '2026-07-15',
    });
    expect(r.fromDate).toBe('2026-07-01');
    expect(r.toDate).toBe('2026-07-15');
    expect(r.from).toEqual(moscowDayStart('2026-07-01'));
  });
});
