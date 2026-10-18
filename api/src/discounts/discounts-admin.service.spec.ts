import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { DiscountRewardType, DiscountScope } from '@prisma/client';
import { DiscountsAdminService } from './discounts-admin.service';

function makePrisma() {
  const prisma = {
    discount: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    discountCategory: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    discountProduct: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    discountRule: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    category: { count: vi.fn() },
    product: { count: vi.fn() },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
    fn(prisma),
  );
  return prisma;
}

function categorySerialized(overrides: Record<string, unknown> = {}) {
  return {
    id: 'd1',
    name: 'Весна',
    description: 'desc',
    scope: DiscountScope.CATEGORY,
    active: true,
    startsAt: new Date('2026-07-01T00:00:00.000Z'),
    endsAt: null,
    categories: [
      {
        categoryId: 'c1',
        category: {
          id: 'c1',
          name: 'Лицо',
          slug: 'lico',
          parentId: null,
          parent: null,
        },
      },
    ],
    products: [],
    rules: [
      {
        id: 'r1',
        name: '−10%',
        conditions: { logic: 'AND', items: [{ kind: 'MIN_QTY', value: 2 }] },
        description: null,
        rewardType: DiscountRewardType.PERCENT,
        rewardValue: 10,
        sortOrder: 0,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('DiscountsAdminService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let svc: DiscountsAdminService;

  beforeEach(() => {
    prisma = makePrisma();
    svc = new DiscountsAdminService(prisma as never);
  });

  it('create пишет scope CATEGORY + правило', async () => {
    prisma.category.count.mockResolvedValue(1);
    prisma.discount.create.mockResolvedValue(categorySerialized());

    const row = await svc.create({
      name: 'Весна',
      description: 'desc',
      scope: DiscountScope.CATEGORY,
      startsAt: '2026-07-01T00:00:00.000Z',
      categoryIds: ['c1'],
      rules: [
        {
          name: '−10%',
          conditions: { logic: 'AND', items: [{ kind: 'MIN_QTY', value: 2 }] },
          rewardType: DiscountRewardType.PERCENT,
          rewardValue: 10,
        },
      ],
    });

    expect(row.id).toBe('d1');
    expect(row.categoryIds).toEqual(['c1']);
    expect(row.rules[0].rewardValue).toBe(10);
    expect(row.status).toBeTruthy();
  });

  it('create пишет scope PRODUCTS', async () => {
    prisma.product.count.mockResolvedValue(2);
    prisma.discount.create.mockResolvedValue(
      categorySerialized({
        scope: DiscountScope.PRODUCTS,
        categories: [],
        products: [
          {
            productId: 'p1',
            product: { id: 'p1', name: 'Крем', slug: 'krem' },
          },
          {
            productId: 'p2',
            product: { id: 'p2', name: 'Сыв', slug: 'syv' },
          },
        ],
      }),
    );

    const row = await svc.create({
      name: 'Товары',
      scope: DiscountScope.PRODUCTS,
      startsAt: '2026-07-01T00:00:00.000Z',
      productIds: ['p1', 'p2'],
      rules: [
        {
          name: '−100₽',
          rewardType: DiscountRewardType.FIXED,
          rewardValue: 100,
        },
      ],
    });

    expect(row.scope).toBe(DiscountScope.PRODUCTS);
    expect(row.productIds).toEqual(['p1', 'p2']);
    expect(prisma.product.count).toHaveBeenCalled();
  });

  it('create отклоняет percent > 100', async () => {
    prisma.category.count.mockResolvedValue(1);
    await expect(
      svc.create({
        name: 'X',
        scope: DiscountScope.CATEGORY,
        startsAt: '2026-07-01T00:00:00.000Z',
        categoryIds: ['c1'],
        rules: [
          {
            name: 'bad',
            rewardType: DiscountRewardType.PERCENT,
            rewardValue: 150,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create отклоняет endsAt < startsAt', async () => {
    prisma.category.count.mockResolvedValue(1);
    await expect(
      svc.create({
        name: 'X',
        scope: DiscountScope.CATEGORY,
        startsAt: '2026-07-10T00:00:00.000Z',
        endsAt: '2026-07-01T00:00:00.000Z',
        categoryIds: ['c1'],
        rules: [],
      }),
    ).rejects.toThrow(/окончания/);
  });

  it('create отклоняет пустой scope CATEGORY', async () => {
    await expect(
      svc.create({
        name: 'X',
        scope: DiscountScope.CATEGORY,
        startsAt: '2026-07-01T00:00:00.000Z',
        categoryIds: [],
        rules: [],
      }),
    ).rejects.toThrow(/категори/);
  });

  it('create отклоняет пустой scope PRODUCTS', async () => {
    await expect(
      svc.create({
        name: 'X',
        scope: DiscountScope.PRODUCTS,
        startsAt: '2026-07-01T00:00:00.000Z',
        productIds: [],
        rules: [],
      }),
    ).rejects.toThrow(/товар/);
  });

  it('update upsert: обновляет правило по id, не delete+recreate всех', async () => {
    prisma.discount.findUnique.mockResolvedValue({
      id: 'd1',
      name: 'Весна',
      description: null,
      scope: DiscountScope.CATEGORY,
      active: true,
      startsAt: new Date('2026-07-01T00:00:00.000Z'),
      endsAt: null,
    });
    prisma.category.count.mockResolvedValue(1);
    prisma.discountCategory.findMany.mockResolvedValue([{ categoryId: 'c1' }]);
    prisma.discountRule.findMany.mockResolvedValue([{ id: 'r1' }]);
    prisma.discount.findUniqueOrThrow.mockResolvedValue(
      categorySerialized({
        rules: [
          {
            id: 'r1',
            name: '−15%',
            conditions: { logic: 'AND', items: [{ kind: 'MIN_QTY', value: 3 }] },
            description: null,
            rewardType: DiscountRewardType.PERCENT,
            rewardValue: 15,
            sortOrder: 0,
          },
        ],
      }),
    );

    const row = await svc.update('d1', {
      name: 'Весна+',
      scope: DiscountScope.CATEGORY,
      categoryIds: ['c1'],
      rules: [
        {
          id: 'r1',
          name: '−15%',
          conditions: { logic: 'AND', items: [{ kind: 'MIN_QTY', value: 3 }] },
          rewardType: DiscountRewardType.PERCENT,
          rewardValue: 15,
        },
      ],
    });

    expect(prisma.discountRule.deleteMany).toHaveBeenCalledWith({
      where: { discountId: 'd1', id: { notIn: ['r1'] } },
    });
    expect(prisma.discountRule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r1' },
        data: expect.objectContaining({ name: '−15%', rewardValue: 15 }),
      }),
    );
    expect(prisma.discountRule.create).not.toHaveBeenCalled();
    expect(row.rules[0].id).toBe('r1');
    expect(row.rules[0].rewardValue).toBe(15);
  });
});
