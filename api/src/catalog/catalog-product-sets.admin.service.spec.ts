import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogProductSetsAdminService } from './catalog-product-sets.admin.service';

function makePrisma() {
  return {
    product: { count: vi.fn() },
    productSet: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    productSetItem: {
      createMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      aggregate: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}

describe('CatalogProductSetsAdminService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let svc: CatalogProductSetsAdminService;

  beforeEach(() => {
    prisma = makePrisma();
    svc = new CatalogProductSetsAdminService(prisma as never);
  });

  it('createProductSet пишет slug и productIds по порядку', async () => {
    prisma.product.count.mockResolvedValue(2);
    prisma.productSet.findUnique.mockResolvedValue(null);

    const serialized = {
      id: 'set1',
      name: 'Уход',
      slug: 'uhod',
      active: true,
      sortOrder: 0,
      items: [
        {
          sortOrder: 0,
          product: { id: 'p1', name: 'A', slug: 'a' },
        },
        {
          sortOrder: 1,
          product: { id: 'p2', name: 'B', slug: 'b' },
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        productSet: {
          create: vi.fn().mockResolvedValue({ id: 'set1' }),
          findUniqueOrThrow: vi.fn().mockResolvedValue(serialized),
        },
        productSetItem: {
          createMany: vi.fn(),
        },
      };
      return fn(tx);
    });

    const row = await svc.createProductSet({
      name: 'Уход',
      productIds: ['p1', 'p2', 'p1'],
    });

    expect(row.slug).toBe('uhod');
    expect(row.productIds).toEqual(['p1', 'p2']);
    expect(row.itemCount).toBe(2);
  });
});
