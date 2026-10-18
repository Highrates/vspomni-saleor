import { describe, expect, it } from 'vitest';
import { DiscountRewardType, DiscountScope } from '@prisma/client';
import {
  allocateDiscount,
  priceCartLines,
  type CampaignIn,
  type PricingLineIn,
} from './discount-pricing.engine';

const line = (
  key: string,
  opts: Partial<PricingLineIn> & Pick<PricingLineIn, 'productId' | 'listPrice'>,
): PricingLineIn => ({
  key,
  productId: opts.productId,
  categoryId: opts.categoryId ?? 'cat',
  qty: opts.qty ?? 1,
  listPrice: opts.listPrice,
});

const campaign = (partial: Partial<CampaignIn> & Pick<CampaignIn, 'id' | 'rules'>): CampaignIn => ({
  id: partial.id,
  name: partial.name ?? partial.id,
  startsAt: partial.startsAt ?? new Date('2026-01-01'),
  scope: partial.scope ?? DiscountScope.PRODUCTS,
  categoryIds: partial.categoryIds ?? [],
  productIds: partial.productIds ?? ['p1'],
  rules: partial.rules,
});

describe('allocateDiscount', () => {
  it('раздаёт FIXED пропорционально с остатком на крупную строку', () => {
    const lines = [
      line('a', { productId: 'p1', listPrice: 1000, qty: 1 }),
      line('b', { productId: 'p2', listPrice: 3000, qty: 1 }),
    ];
    const m = allocateDiscount(lines, 100);
    expect((m.get('a') ?? 0) + (m.get('b') ?? 0)).toBe(100);
    expect(m.get('b')).toBeGreaterThanOrEqual(m.get('a')!);
  });
});

describe('priceCartLines', () => {
  it('PERCENT снижает unit price', () => {
    const res = priceCartLines(
      [line('a', { productId: 'p1', listPrice: 1000, qty: 2 })],
      [
        campaign({
          id: 'd1',
          productIds: ['p1'],
          rules: [
            {
              id: 'r1',
              sortOrder: 0,
              conditions: null,
              rewardType: DiscountRewardType.PERCENT,
              rewardValue: 10,
            },
          ],
        }),
      ],
    );
    expect(res.campaignDiscountTotal).toBe(200);
    expect(res.lines[0]!.price).toBe(900);
    expect(res.subtotal).toBe(1800);
  });

  it('кампании на одну позицию не стакаются — берётся max benefit', () => {
    const res = priceCartLines(
      [line('a', { productId: 'p1', listPrice: 1000 })],
      [
        campaign({
          id: 'd10',
          startsAt: new Date('2026-01-01'),
          productIds: ['p1'],
          rules: [
            {
              id: 'r1',
              sortOrder: 0,
              conditions: null,
              rewardType: DiscountRewardType.PERCENT,
              rewardValue: 10,
            },
          ],
        }),
        campaign({
          id: 'd20',
          startsAt: new Date('2026-02-01'),
          productIds: ['p1'],
          rules: [
            {
              id: 'r2',
              sortOrder: 0,
              conditions: null,
              rewardType: DiscountRewardType.PERCENT,
              rewardValue: 20,
            },
          ],
        }),
      ],
    );
    expect(res.lines[0]!.discountId).toBe('d20');
    expect(res.lines[0]!.price).toBe(800);
  });

  it('CATEGORY scope только по явным categoryId', () => {
    const res = priceCartLines(
      [
        line('a', { productId: 'p1', categoryId: 'c1', listPrice: 1000 }),
        line('b', { productId: 'p2', categoryId: 'c2', listPrice: 1000 }),
      ],
      [
        campaign({
          id: 'd1',
          scope: DiscountScope.CATEGORY,
          categoryIds: ['c1'],
          productIds: [],
          rules: [
            {
              id: 'r1',
              sortOrder: 0,
              conditions: null,
              rewardType: DiscountRewardType.PERCENT,
              rewardValue: 50,
            },
          ],
        }),
      ],
    );
    expect(res.lines[0]!.price).toBe(500);
    expect(res.lines[1]!.price).toBe(1000);
  });

  it('MIN_AMOUNT по области — не по всей корзине', () => {
    const res = priceCartLines(
      [
        line('a', { productId: 'p1', listPrice: 400 }),
        line('b', { productId: 'p2', listPrice: 5000 }),
      ],
      [
        campaign({
          id: 'd1',
          productIds: ['p1'],
          rules: [
            {
              id: 'r1',
              sortOrder: 0,
              conditions: { logic: 'AND', items: [{ kind: 'MIN_AMOUNT', value: 1000 }] },
              rewardType: DiscountRewardType.PERCENT,
              rewardValue: 50,
            },
          ],
        }),
      ],
    );
    expect(res.lines[0]!.price).toBe(400);
    expect(res.campaignDiscountTotal).toBe(0);
  });
});
