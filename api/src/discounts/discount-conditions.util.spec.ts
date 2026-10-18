import { describe, expect, it } from 'vitest';
import { DiscountRewardType } from '@prisma/client';
import {
  assertRewardValue,
  DiscountConditionsError,
  normalizeConditions,
} from './discount-conditions.util';

describe('assertRewardValue', () => {
  it('ok для percent 1–100 и fixed ≥ 1', () => {
    expect(assertRewardValue(DiscountRewardType.PERCENT, 10)).toBeNull();
    expect(assertRewardValue(DiscountRewardType.PERCENT, 100)).toBeNull();
    expect(assertRewardValue(DiscountRewardType.FIXED, 1)).toBeNull();
    expect(assertRewardValue(DiscountRewardType.FIXED, 500)).toBeNull();
  });

  it('отклоняет не-целое / < 1', () => {
    expect(assertRewardValue(DiscountRewardType.FIXED, 0)).toMatch(/≥ 1/);
    expect(assertRewardValue(DiscountRewardType.PERCENT, 1.5)).toMatch(/≥ 1/);
    expect(assertRewardValue(DiscountRewardType.FIXED, NaN)).toMatch(/≥ 1/);
  });

  it('отклоняет percent > 100', () => {
    expect(assertRewardValue(DiscountRewardType.PERCENT, 101)).toMatch(/1 до 100/);
  });
});

describe('normalizeConditions', () => {
  it('null / undefined / [] → null', () => {
    expect(normalizeConditions(null)).toBeNull();
    expect(normalizeConditions(undefined)).toBeNull();
    expect(normalizeConditions({ logic: 'AND', items: [] })).toBeNull();
  });

  it('reject битых items (не тихо дропать)', () => {
    expect(() =>
      normalizeConditions({
        logic: 'AND',
        items: [{ kind: 'MIN_QTY', value: 0 }],
      }),
    ).toThrow(DiscountConditionsError);
    expect(() =>
      normalizeConditions({
        logic: 'AND',
        items: [{ kind: 'NOPE', value: 2 }],
      }),
    ).toThrow(DiscountConditionsError);
  });

  it('reject дубликатов kind', () => {
    expect(() =>
      normalizeConditions({
        logic: 'AND',
        items: [
          { kind: 'MIN_QTY', value: 2 },
          { kind: 'MIN_QTY', value: 5 },
        ],
      }),
    ).toThrow(/Дубликат/);
  });

  it('нормализует logic и items', () => {
    expect(
      normalizeConditions({
        logic: 'OR',
        items: [
          { kind: 'MIN_QTY', value: 2 },
          { kind: 'MIN_AMOUNT', value: 1000 },
        ],
      }),
    ).toEqual({
      logic: 'OR',
      items: [
        { kind: 'MIN_QTY', value: 2 },
        { kind: 'MIN_AMOUNT', value: 1000 },
      ],
    });
    expect(
      normalizeConditions({
        logic: 'XOR',
        items: [{ kind: 'MIN_LINES', value: 3 }],
      }),
    ).toEqual({
      logic: 'AND',
      items: [{ kind: 'MIN_LINES', value: 3 }],
    });
  });
});
