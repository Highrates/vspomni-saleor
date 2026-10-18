import { describe, expect, it } from 'vitest';
import { deriveDiscountStatus, discountStatusWhere } from './discount-status.util';

const base = {
  startsAt: new Date('2026-07-01T00:00:00.000Z'),
  endsAt: new Date('2026-07-31T23:59:59.000Z') as Date | null,
  ruleCount: 1,
};

describe('deriveDiscountStatus', () => {
  it('Выкл при active=false', () => {
    expect(
      deriveDiscountStatus(
        { ...base, active: false },
        new Date('2026-07-15T12:00:00.000Z'),
      ),
    ).toBe('OFF');
  });

  it('Черновик без правил', () => {
    expect(
      deriveDiscountStatus(
        { ...base, active: true, ruleCount: 0 },
        new Date('2026-07-15T12:00:00.000Z'),
      ),
    ).toBe('DRAFT');
  });

  it('Запланирована до старта', () => {
    expect(
      deriveDiscountStatus(
        { ...base, active: true },
        new Date('2026-06-15T12:00:00.000Z'),
      ),
    ).toBe('SCHEDULED');
  });

  it('Идёт в окне', () => {
    expect(
      deriveDiscountStatus(
        { ...base, active: true },
        new Date('2026-07-15T12:00:00.000Z'),
      ),
    ).toBe('RUNNING');
  });

  it('Идёт без даты окончания', () => {
    expect(
      deriveDiscountStatus(
        { ...base, active: true, endsAt: null },
        new Date('2027-01-01T00:00:00.000Z'),
      ),
    ).toBe('RUNNING');
  });

  it('Истекла после endsAt', () => {
    expect(
      deriveDiscountStatus(
        { ...base, active: true },
        new Date('2026-08-01T00:00:00.000Z'),
      ),
    ).toBe('EXPIRED');
  });
});

describe('discountStatusWhere', () => {
  const now = new Date('2026-07-15T12:00:00.000Z');

  it('RUNNING требует active + окно + rules', () => {
    expect(discountStatusWhere('RUNNING', now)).toMatchObject({
      active: true,
      startsAt: { lte: now },
    });
  });

  it('OFF только active=false', () => {
    expect(discountStatusWhere('OFF', now)).toEqual({ active: false });
  });
});
