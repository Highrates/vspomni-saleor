import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogTagsAdminService } from './catalog-tags.admin.service';

function makePrisma() {
  return {
    catalogTag: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
    },
    catalogTagImage: {
      aggregate: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    catalogTagStep: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}

function makeStorage() {
  return {
    saveGalleryMedia: vi.fn(),
    deleteByPublicUrl: vi.fn(),
  };
}

describe('CatalogTagsAdminService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let storage: ReturnType<typeof makeStorage>;
  let svc: CatalogTagsAdminService;

  beforeEach(() => {
    prisma = makePrisma();
    storage = makeStorage();
    svc = new CatalogTagsAdminService(prisma as never, storage as never);
  });

  it('createCatalogTag пишет slug из name', async () => {
    prisma.catalogTag.findUnique.mockResolvedValue(null);
    prisma.catalogTag.create.mockResolvedValue({
      id: 't1',
      name: 'Глаза',
      slug: 'glaza',
      coverImageUrl: null,
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      _count: { products: 0 },
      images: [],
      steps: [],
    });

    const row = await svc.createCatalogTag({ name: 'Глаза', sortOrder: 1 });
    expect(row.slug).toBe('glaza');
    expect(prisma.catalogTag.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Глаза', slug: 'glaza', sortOrder: 1 }),
        include: expect.objectContaining({
          _count: { select: { products: true } },
          images: expect.any(Object),
          steps: expect.any(Object),
        }),
      }),
    );
  });
});
