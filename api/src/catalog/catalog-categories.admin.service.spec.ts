import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { CatalogCategoriesAdminService } from './catalog-categories.admin.service';

function makePrisma() {
  return {
    category: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    product: {
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}

describe('CatalogCategoriesAdminService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let svc: CatalogCategoriesAdminService;

  beforeEach(() => {
    prisma = makePrisma();
    svc = new CatalogCategoriesAdminService(prisma as never);
  });

  it('createCategory пишет slug из name', async () => {
    prisma.category.findUnique.mockResolvedValue(null);
    prisma.category.aggregate.mockResolvedValue({ _max: { sortOrder: null } });
    prisma.category.create.mockResolvedValue({
      id: 'c1',
      name: 'Лицо',
      slug: 'litso',
      sortOrder: 0,
    });

    const row = await svc.createCategory({ name: 'Лицо' });
    expect(row.slug).toBe('litso');
    expect(prisma.category.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Лицо', slug: 'litso' }),
      }),
    );
  });

  it('deleteCategory блокирует, если есть товары', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 'c1', name: 'Лицо' });
    prisma.category.count.mockResolvedValue(0);
    prisma.product.count.mockResolvedValue(2);

    await expect(svc.deleteCategory('c1')).rejects.toThrow(ConflictException);
    expect(prisma.category.delete).not.toHaveBeenCalled();
  });
});
