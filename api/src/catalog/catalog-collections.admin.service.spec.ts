import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogCollectionsAdminService } from './catalog-collections.admin.service';

function makePrisma() {
  return {
    product: { count: vi.fn() },
    collection: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    collectionItem: {
      createMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      aggregate: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}

describe('CatalogCollectionsAdminService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let svc: CatalogCollectionsAdminService;

  beforeEach(() => {
    prisma = makePrisma();
    svc = new CatalogCollectionsAdminService(prisma as never);
  });

  it('createCollection пишет slug и productIds по порядку', async () => {
    prisma.product.count.mockResolvedValue(2);
    prisma.collection.findUnique.mockResolvedValue(null);

    const serialized = {
      id: 'col1',
      name: 'Хиты',
      slug: 'hity',
      active: true,
      featuredLayout: false,
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
        collection: {
          create: vi.fn().mockResolvedValue({ id: 'col1' }),
          findUniqueOrThrow: vi.fn().mockResolvedValue(serialized),
        },
        collectionItem: {
          createMany: vi.fn(),
        },
      };
      return fn(tx);
    });

    const row = await svc.createCollection({
      name: 'Хиты',
      productIds: ['p1', 'p2', 'p1'],
    });

    expect(row.slug).toBe('hity');
    expect(row.productIds).toEqual(['p1', 'p2']);
    expect(row.itemCount).toBe(2);
  });
});
