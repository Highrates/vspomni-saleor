import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CHOICE_COLLECTION_SLUG } from '@vspomni/catalog-constants';
import { CatalogCategoriesAdminService } from './catalog-categories.admin.service';
import { CatalogProductsAdminService } from './catalog-products.admin.service';

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
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    productVariant: {
      count: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    productImage: {
      count: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
      findUnique: vi.fn(),
    },
    productVariantImage: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    productCatalogTag: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    catalogTag: {
      count: vi.fn(),
    },
    collection: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
    collectionItem: {
      createMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      aggregate: vi.fn(),
    },
    productSet: {
      count: vi.fn(),
    },
    productSetItem: {
      createMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
    productVariantShade: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    productAromaNote: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    aromaNoteDefinition: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    orderItem: { count: vi.fn() },
    $transaction: vi.fn(),
  };
}

type SyncNotes = (
  tx: unknown,
  productId: string,
  raw: Array<{
    id?: string;
    kind: 'BASIC' | 'MIDDLE' | 'HEAD';
    definitionId?: string;
    name?: string;
    imageUrl?: string | null;
    sortOrder?: number;
  }>,
) => Promise<void>;

describe('CatalogProductsAdminService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let svc: CatalogProductsAdminService;
  const storage = {
    saveImage: vi.fn(),
    deleteByPublicUrl: vi.fn(),
    deleteManagedUpload: vi.fn(),
    tryPublicUrlToKey: vi.fn(),
  };

  beforeEach(() => {
    prisma = makePrisma();
    storage.deleteManagedUpload.mockReset();
    storage.deleteByPublicUrl.mockReset();
    storage.tryPublicUrlToKey = vi.fn((u: string) =>
      u.includes('/uploads/') ? u.replace(/^.*\/uploads\//, '') : null,
    );
    prisma.collection.findFirst.mockResolvedValue(null);
    prisma.collectionItem.findFirst.mockResolvedValue(null);
    prisma.collectionItem.findMany.mockResolvedValue([]);
    const categories = new CatalogCategoriesAdminService(prisma as never);
    svc = new CatalogProductsAdminService(prisma as never, storage as never, categories);
  });

  it('createProduct требует категорию; variants опциональны', async () => {
    prisma.category.findUnique.mockResolvedValue(null);
    await expect(
      svc.createProduct({
        name: 'Крем',
        categoryId: 'missing',
        variants: [{ name: '50 мл', volumeMl: 50, price: 100 }],
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('addVariant пишет volumeMl и SKU с мл', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'p1',
      slug: 'krem',
    });
    prisma.productVariant.findFirst.mockResolvedValue(null);
    prisma.productVariant.findUnique.mockResolvedValue(null);

    const created = {
      id: 'v1',
      productId: 'p1',
      name: '50 мл',
      slug: '50-ml',
      nationalCatalogName: null,
      volumeMl: 50,
      sku: 'krem-50ml',
      price: 990,
      compareAt: null,
      orderMinQty: 1,
      orderMaxQty: null,
      weightGrams: null,
      lengthMm: null,
      widthMm: null,
      heightMm: null,
      packageVolume: null,
      stock: 0,
      stockReserve: 0,
      active: true,
      galleryLinks: [],
      shades: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        productVariant: {
          findFirst: prisma.productVariant.findFirst,
          findUnique: prisma.productVariant.findUnique,
          create: vi.fn().mockResolvedValue(created),
        },
        productImage: { findMany: vi.fn() },
        productVariantImage: {
          deleteMany: vi.fn(),
          createMany: vi.fn(),
        },
      };
      return fn(tx);
    });

    const row = await svc.addVariant('p1', {
      name: '50 мл',
      volumeMl: 50,
      price: 990,
    });

    expect(row.volumeMl).toBe(50);
    expect(row.sku).toBe('krem-50ml');
  });

  it('deleteProduct блокирует при OrderItem', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'p1',
      variants: [{ id: 'v1' }],
      images: [],
    });
    prisma.orderItem.count.mockResolvedValue(1);

    await expect(svc.deleteProduct('p1')).rejects.toThrow(ConflictException);
    expect(prisma.product.delete).not.toHaveBeenCalled();
  });

  it('deleteVariant удаляет вариант без заказов', async () => {
    prisma.productVariant.findUnique.mockResolvedValue({
      id: 'v1',
      productId: 'p1',
    });
    prisma.orderItem.count.mockResolvedValue(0);
    prisma.productVariant.delete.mockResolvedValue({});

    await expect(svc.deleteVariant('v1')).resolves.toEqual({ ok: true });
    expect(prisma.productVariant.delete).toHaveBeenCalledWith({ where: { id: 'v1' } });
  });

  function productDetailRow(
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      id: 'p1',
      slug: 'p',
      name: 'P',
      categoryId: 'c1',
      shortDescription: null,
      pageShortDescriptionHtml: null,
      descriptionHtml: null,
      actionEffectHtml: null,
      applicationHtml: null,
      compositionHtml: null,
      importantNoteHtml: null,
      vspomniNoteHtml: null,
      storageHtml: null,
      productType: null,
      purpose: null,
      shelfLife: null,
      productTypeOptionId: null,
      purposeOptionId: null,
      shelfLifeOptionId: null,
      storageOptionId: null,
      extraHtml: null,
      cardAromaLabels: [],
      badgeLabel: null,
      choiceStarName: null,
      choiceStarDate: null,
      choiceStarImageUrl: null,
      active: true,
      excludeFromCatalog: false,
      metaTitle: null,
      metaDescription: null,
      ogImageUrl: null,
      canonicalPath: null,
      seoNoIndex: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      category: null,
      variants: [],
      images: [],
      catalogTags: [],
      collectionItems: [],
      productSetItems: [],
      aromaNotes: [],
      ...overrides,
    };
  }

  it('createProduct пишет choiceStar* (дата UTC noon, URL relative)', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 'c1', name: 'Cat' });
    prisma.product.findUnique.mockResolvedValue(null);

    let createData: Record<string, unknown> | undefined;
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        productAttributeOption: { findFirst: vi.fn() },
        product: {
          create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
            createData = data;
            return { id: 'p1', ...data };
          }),
          findUniqueOrThrow: vi.fn().mockImplementation(async () =>
            productDetailRow({
              choiceStarName: createData?.choiceStarName,
              choiceStarDate: createData?.choiceStarDate,
              choiceStarImageUrl: createData?.choiceStarImageUrl,
            }),
          ),
        },
        productCatalogTag: {
          deleteMany: prisma.productCatalogTag.deleteMany,
          createMany: prisma.productCatalogTag.createMany,
        },
        catalogTag: { count: prisma.catalogTag.count },
        collection: {
          count: prisma.collection.count,
          findFirst: prisma.collection.findFirst,
        },
        collectionItem: {
          deleteMany: prisma.collectionItem.deleteMany,
          createMany: prisma.collectionItem.createMany,
          findMany: vi.fn().mockResolvedValue([]),
          findFirst: prisma.collectionItem.findFirst,
          create: prisma.collectionItem.create,
          aggregate: prisma.collectionItem.aggregate,
        },
        productSet: { count: prisma.productSet.count },
        productSetItem: {
          deleteMany: prisma.productSetItem.deleteMany,
          createMany: prisma.productSetItem.createMany,
          findMany: vi.fn().mockResolvedValue([]),
          create: prisma.productSetItem.create,
          aggregate: prisma.productSetItem.aggregate,
        },
      };
      return fn(tx);
    });

    const row = await svc.createProduct({
      name: 'Диффузор',
      categoryId: 'c1',
      choiceStarName: ' Анна ',
      choiceStarDate: '2026-03-15',
      choiceStarImageUrl: 'http://127.0.0.1:3011/uploads/stars/anna.jpg',
    });

    expect(createData).toMatchObject({
      choiceStarName: 'Анна',
      choiceStarImageUrl: '/uploads/stars/anna.jpg',
    });
    expect(createData?.choiceStarDate).toBeInstanceOf(Date);
    expect((createData?.choiceStarDate as Date).toISOString()).toBe(
      '2026-03-15T12:00:00.000Z',
    );
    expect(row.choiceStarName).toBe('Анна');
    expect(row.choiceStarDate).toBe('2026-03-15');
    expect(row.choiceStarImageUrl).toBe('/uploads/stars/anna.jpg');
  });

  it('updateProduct обновляет choiceStar* и GC старого фото', async () => {
    prisma.product.findUnique
      .mockResolvedValueOnce(
        productDetailRow({
          choiceStarName: 'Старое',
          choiceStarImageUrl: '/uploads/stars/old.jpg',
        }),
      )
      .mockResolvedValueOnce(
        productDetailRow({
          choiceStarName: 'Новое',
          choiceStarDate: new Date('2026-04-01T12:00:00.000Z'),
          choiceStarImageUrl: '/uploads/stars/new.jpg',
        }),
      );

    prisma.product.update.mockResolvedValue({});
    prisma.product.count.mockResolvedValue(0);
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn(prisma),
    );

    const row = await svc.updateProduct('p1', {
      choiceStarName: 'Новое',
      choiceStarDate: '2026-04-01',
      choiceStarImageUrl: 'https://vspomni.store/uploads/stars/new.jpg',
    });

    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: expect.objectContaining({
        choiceStarName: 'Новое',
        choiceStarImageUrl: '/uploads/stars/new.jpg',
        choiceStarDate: new Date('2026-04-01T12:00:00.000Z'),
      }),
    });
    expect(storage.deleteManagedUpload).toHaveBeenCalledWith('/uploads/stars/old.jpg');
    expect(row.choiceStarName).toBe('Новое');
    expect(row.choiceStarDate).toBe('2026-04-01');
  });

  it('updateProduct очищает choiceStar и удаляет файл', async () => {
    prisma.product.findUnique
      .mockResolvedValueOnce(
        productDetailRow({
          choiceStarName: 'Анна',
          choiceStarImageUrl: '/uploads/stars/anna.jpg',
        }),
      )
      .mockResolvedValueOnce(productDetailRow());

    prisma.product.update.mockResolvedValue({});
    prisma.product.count.mockResolvedValue(0);
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn(prisma),
    );

    await svc.updateProduct('p1', {
      choiceStarName: null,
      choiceStarDate: null,
      choiceStarImageUrl: null,
    });

    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: expect.objectContaining({
        choiceStarName: null,
        choiceStarDate: null,
        choiceStarImageUrl: null,
      }),
    });
    expect(storage.deleteManagedUpload).toHaveBeenCalledWith(
      '/uploads/stars/anna.jpg',
    );
  });

  it('updateProduct в vybor без choiceStarName → 400', async () => {
    prisma.product.findUnique
      .mockResolvedValueOnce(productDetailRow({ choiceStarName: null }))
      .mockResolvedValueOnce(productDetailRow({ choiceStarName: null }));
    prisma.product.update.mockResolvedValue({});
    prisma.collection.count.mockResolvedValue(1);
    prisma.collectionItem.findMany.mockResolvedValue([]);
    prisma.collectionItem.aggregate.mockResolvedValue({ _max: { sortOrder: 0 } });
    prisma.collectionItem.create.mockResolvedValue({});
    prisma.collection.findFirst.mockResolvedValue({
      id: 'col-vybor',
      slug: CHOICE_COLLECTION_SLUG,
    });
    prisma.collectionItem.findFirst.mockResolvedValue({
      productId: 'p1',
      collectionId: 'col-vybor',
    });
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn(prisma),
    );

    await expect(
      svc.updateProduct('p1', {
        collectionIds: ['col-vybor'],
        choiceStarName: null,
      }),
    ).rejects.toThrow(/Выбор/);
  });

  it('discardUploads удаляет непривязанный URL', async () => {
    prisma.product.count.mockResolvedValue(0);
    prisma.productImage.count.mockResolvedValue(0);
    storage.deleteManagedUpload.mockResolvedValue(true);

    const res = await svc.discardUploads([
      'http://127.0.0.1:3011/uploads/stars/orphan.jpg',
    ]);
    expect(res.deleted).toBe(1);
    expect(storage.deleteManagedUpload).toHaveBeenCalledWith(
      '/uploads/stars/orphan.jpg',
    );
  });

  it('discardUploads не трогает URL, на который ссылается товар', async () => {
    prisma.product.count.mockResolvedValue(1);
    prisma.productImage.count.mockResolvedValue(0);

    const res = await svc.discardUploads(['/uploads/stars/used.jpg']);
    expect(res.deleted).toBe(0);
    expect(storage.deleteManagedUpload).not.toHaveBeenCalled();
  });

  it('updateProduct sync коллекций сохраняет sortOrder существующих связей', async () => {
    prisma.product.findUnique
      .mockResolvedValueOnce({ id: 'p1', slug: 'p', categoryId: 'c1' })
      .mockResolvedValueOnce({
        id: 'p1',
        slug: 'p',
        name: 'P',
        categoryId: 'c1',
        shortDescription: null,
        pageShortDescriptionHtml: null,
        descriptionHtml: null,
        actionEffectHtml: null,
        applicationHtml: null,
        compositionHtml: null,
        importantNoteHtml: null,
        vspomniNoteHtml: null,
        storageHtml: null,
        productType: null,
        purpose: null,
        shelfLife: null,
        extraHtml: null,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: null,
        variants: [],
        images: [],
        catalogTags: [],
        collectionItems: [{ collectionId: 'col-keep' }],
        productSetItems: [],
      });

    prisma.collection.count.mockResolvedValue(2);
    prisma.collectionItem.findMany.mockResolvedValue([
      { id: 'ci1', collectionId: 'col-keep', productId: 'p1', sortOrder: 3 },
      { id: 'ci2', collectionId: 'col-old', productId: 'p1', sortOrder: 1 },
    ]);
    prisma.collectionItem.aggregate.mockResolvedValue({ _max: { sortOrder: 7 } });

    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));

    await svc.updateProduct('p1', {
      collectionIds: ['col-keep', 'col-new'],
    });

    expect(prisma.collectionItem.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['ci2'] } },
    });
    expect(prisma.collectionItem.create).toHaveBeenCalledWith({
      data: { collectionId: 'col-new', productId: 'p1', sortOrder: 8 },
    });
    // существующая col-keep не пересоздаётся
    expect(prisma.collectionItem.create).toHaveBeenCalledTimes(1);
  });

  it('updateProduct sync наборов сохраняет sortOrder', async () => {
    prisma.product.findUnique
      .mockResolvedValueOnce({ id: 'p1', slug: 'p', categoryId: 'c1' })
      .mockResolvedValueOnce({
        id: 'p1',
        slug: 'p',
        name: 'P',
        categoryId: 'c1',
        shortDescription: null,
        pageShortDescriptionHtml: null,
        descriptionHtml: null,
        actionEffectHtml: null,
        applicationHtml: null,
        compositionHtml: null,
        importantNoteHtml: null,
        vspomniNoteHtml: null,
        storageHtml: null,
        productType: null,
        purpose: null,
        shelfLife: null,
        extraHtml: null,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: null,
        variants: [],
        images: [],
        catalogTags: [],
        collectionItems: [],
        productSetItems: [{ productSetId: 'set-keep' }],
      });

    prisma.productSet.count.mockResolvedValue(1);
    prisma.productSetItem.findMany.mockResolvedValue([
      { id: 'si1', productSetId: 'set-keep', productId: 'p1', sortOrder: 2 },
    ]);

    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));

    await svc.updateProduct('p1', {
      productSetIds: ['set-keep'],
    });

    expect(prisma.productSetItem.deleteMany).not.toHaveBeenCalled();
    expect(prisma.productSetItem.create).not.toHaveBeenCalled();
  });

  it('updateVariant shades: обновляет, создаёт и удаляет лишние', async () => {
    prisma.productVariant.findUnique.mockResolvedValue({
      id: 'v1',
      productId: 'p1',
      name: '50 мл',
      slug: '50-ml',
      sku: 'sku-1',
      volumeMl: 50,
      orderMinQty: 1,
      orderMaxQty: null,
      nationalCatalogName: null,
      price: 100,
      compareAt: null,
      weightGrams: null,
      lengthMm: null,
      widthMm: null,
      heightMm: null,
      packageVolume: null,
      stock: 0,
      stockReserve: 0,
      active: true,
      product: { id: 'p1', slug: 'krem' },
    });

    prisma.productVariantShade.findMany.mockResolvedValue([
      { id: 's1', name: 'Старое', imageUrl: null, sortOrder: 0 },
      { id: 's-del', name: 'Удалить', imageUrl: '/x.png', sortOrder: 1 },
    ]);

    const finalVariant = {
      id: 'v1',
      productId: 'p1',
      name: '50 мл',
      slug: '50-ml',
      nationalCatalogName: null,
      volumeMl: 50,
      sku: 'sku-1',
      price: 100,
      compareAt: null,
      orderMinQty: 1,
      orderMaxQty: null,
      weightGrams: null,
      lengthMm: null,
      widthMm: null,
      heightMm: null,
      packageVolume: null,
      stock: 0,
      stockReserve: 0,
      active: true,
      galleryLinks: [],
      shades: [
        { id: 's1', name: 'Роза', imageUrl: null, sortOrder: 0 },
        { id: 's-new', name: 'Мята', imageUrl: '/m.png', sortOrder: 1 },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    prisma.productVariant.findUniqueOrThrow.mockResolvedValue(finalVariant);
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));

    await svc.updateVariant('v1', {
      shades: [
        { id: 's1', name: 'Роза', imageUrl: null, sortOrder: 0 },
        { name: 'Мята', imageUrl: '/m.png', sortOrder: 1 },
      ],
    });

    expect(prisma.productVariantShade.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['s-del'] } },
    });
    expect(storage.deleteByPublicUrl).toHaveBeenCalledWith('/x.png');
    expect(prisma.productVariantShade.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { name: 'Роза', imageUrl: null, sortOrder: 0 },
    });
    expect(prisma.productVariantShade.create).toHaveBeenCalledWith({
      data: {
        variantId: 'v1',
        name: 'Мята',
        imageUrl: '/m.png',
        sortOrder: 1,
      },
    });
  });

  it('updateVariant не переписывает slug/SKU при смене имени', async () => {
    prisma.productVariant.findUnique.mockResolvedValue({
      id: 'v1',
      productId: 'p1',
      name: '50 мл',
      slug: '50-ml',
      sku: 'keep-sku',
      volumeMl: 50,
      orderMinQty: 1,
      orderMaxQty: null,
      nationalCatalogName: null,
      price: 100,
      compareAt: null,
      weightGrams: null,
      lengthMm: null,
      widthMm: null,
      heightMm: null,
      packageVolume: null,
      stock: 0,
      stockReserve: 0,
      active: true,
      product: { id: 'p1', slug: 'krem' },
    });

    prisma.productVariant.findUniqueOrThrow.mockResolvedValue({
      id: 'v1',
      productId: 'p1',
      name: 'Новое',
      slug: '50-ml',
      nationalCatalogName: null,
      volumeMl: 50,
      sku: 'keep-sku',
      price: 100,
      compareAt: null,
      orderMinQty: 1,
      orderMaxQty: null,
      weightGrams: null,
      lengthMm: null,
      widthMm: null,
      heightMm: null,
      packageVolume: null,
      stock: 0,
      stockReserve: 0,
      active: true,
      galleryLinks: [],
      shades: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));

    await svc.updateVariant('v1', { name: 'Новое' });

    expect(prisma.productVariant.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { name: 'Новое' },
    });
  });

  describe('syncProductAromaNotes', () => {
    function sync(): SyncNotes {
      return (
        svc as unknown as { syncProductAromaNotes: SyncNotes }
      ).syncProductAromaNotes.bind(svc);
    }

    it('upsert сохраняет id при повторном save', async () => {
      prisma.productAromaNote.findMany
        .mockResolvedValueOnce([
          { id: 'n1', imageUrl: '/uploads/old-override.jpg' },
        ])
        .mockResolvedValueOnce([
          { imageUrl: '/uploads/old-override.jpg' },
        ]);
      prisma.aromaNoteDefinition.findUnique.mockResolvedValue({ id: 'd1' });
      prisma.productAromaNote.update.mockResolvedValue({});
      prisma.productAromaNote.count.mockResolvedValue(1);
      prisma.aromaNoteDefinition.count.mockResolvedValue(0);

      await sync()(prisma, 'p1', [
        {
          id: 'n1',
          kind: 'BASIC',
          definitionId: 'd1',
          imageUrl: '/uploads/old-override.jpg',
        },
      ]);

      expect(prisma.productAromaNote.deleteMany).not.toHaveBeenCalled();
      expect(prisma.productAromaNote.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: {
          definitionId: 'd1',
          kind: 'BASIC',
          imageUrl: '/uploads/old-override.jpg',
          sortOrder: 0,
        },
      });
      expect(prisma.productAromaNote.create).not.toHaveBeenCalled();
      expect(storage.deleteManagedUpload).not.toHaveBeenCalled();
    });

    it('удалённая нота чистит orphan override', async () => {
      prisma.productAromaNote.findMany
        .mockResolvedValueOnce([
          { id: 'n1', imageUrl: '/uploads/orphan.jpg' },
        ])
        .mockResolvedValueOnce([]);
      prisma.productAromaNote.deleteMany.mockResolvedValue({ count: 1 });
      prisma.productAromaNote.count.mockResolvedValue(0);
      prisma.aromaNoteDefinition.count.mockResolvedValue(0);

      await sync()(prisma, 'p1', []);

      expect(prisma.productAromaNote.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['n1'] } },
      });
      expect(storage.deleteManagedUpload).toHaveBeenCalledWith(
        '/uploads/orphan.jpg',
      );
    });

    it('замена override удаляет старый файл, definition.imageUrl не трогает', async () => {
      prisma.productAromaNote.findMany
        .mockResolvedValueOnce([
          { id: 'n1', imageUrl: '/uploads/old.jpg' },
        ])
        .mockResolvedValueOnce([{ imageUrl: '/uploads/new.jpg' }]);
      prisma.aromaNoteDefinition.findUnique.mockResolvedValue({ id: 'd1' });
      prisma.productAromaNote.update.mockResolvedValue({});
      prisma.productAromaNote.count.mockResolvedValue(0);
      prisma.aromaNoteDefinition.count.mockResolvedValue(0);

      await sync()(prisma, 'p1', [
        {
          id: 'n1',
          kind: 'MIDDLE',
          definitionId: 'd1',
          imageUrl: '/uploads/new.jpg',
        },
      ]);

      expect(storage.deleteManagedUpload).toHaveBeenCalledWith('/uploads/old.jpg');
      expect(storage.deleteManagedUpload).not.toHaveBeenCalledWith(
        expect.stringContaining('definition'),
      );
    });

    it('find-or-create definition по имени (case-insensitive)', async () => {
      prisma.productAromaNote.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ imageUrl: null }]);
      prisma.aromaNoteDefinition.findUnique.mockResolvedValue(null);
      prisma.aromaNoteDefinition.create.mockResolvedValue({ id: 'd-new' });
      prisma.productAromaNote.create.mockResolvedValue({ id: 'n-new' });

      await sync()(prisma, 'p1', [
        { kind: 'HEAD', name: '  Ваниль  ', imageUrl: null },
      ]);

      expect(prisma.aromaNoteDefinition.findUnique).toHaveBeenCalledWith({
        where: { nameNormalized: 'ваниль' },
        select: { id: true },
      });
      expect(prisma.aromaNoteDefinition.create).toHaveBeenCalledWith({
        data: { name: 'Ваниль', nameNormalized: 'ваниль' },
        select: { id: true },
      });
      expect(prisma.productAromaNote.create).toHaveBeenCalledWith({
        data: {
          productId: 'p1',
          definitionId: 'd-new',
          kind: 'HEAD',
          imageUrl: null,
          sortOrder: 0,
        },
      });
    });
  });
});
