import { beforeEach, describe, expect, it, vi } from 'vitest';

const categoryFindMany = vi.fn();
const productFindMany = vi.fn();
const catalogTagFindMany = vi.fn();
const collectionFindMany = vi.fn();
const blogPostFindMany = vi.fn();

vi.mock('../prisma/prisma.service', () => ({
  PrismaService: class {
    category = { findMany: categoryFindMany };
    product = { findMany: productFindMany };
    catalogTag = { findMany: catalogTagFindMany };
    collection = { findMany: collectionFindMany };
    blogPost = { findMany: blogPostFindMany };
  },
}));

import {
  normalizeSearchText,
  scoreTitleMatch,
  searchForms,
  SearchPublicService,
} from './search.public.service';
import { PrismaService } from '../prisma/prisma.service';

describe('search helpers', () => {
  it('normalizeSearchText: lower + ё→е', () => {
    expect(normalizeSearchText('  Ёлка  ')).toBe('елка');
  });

  it('searchForms: добавляет вариант без ё', () => {
    expect(searchForms('чёрный')).toEqual(['чёрный', 'черный']);
    expect(searchForms('крем')).toEqual(['крем']);
  });

  it('scoreTitleMatch: exact > prefix > contains', () => {
    expect(scoreTitleMatch('Крем', 'крем')).toBe(100);
    expect(scoreTitleMatch('Крем для лица', 'крем')).toBe(80);
    expect(scoreTitleMatch('Ночной крем', 'крем')).toBe(40);
    expect(scoreTitleMatch('Тональный', 'sku-xyz')).toBe(10);
  });
});

describe('SearchPublicService.search', () => {
  let service: SearchPublicService;

  beforeEach(() => {
    categoryFindMany.mockReset();
    productFindMany.mockReset();
    catalogTagFindMany.mockReset();
    collectionFindMany.mockReset();
    blogPostFindMany.mockReset();

    categoryFindMany.mockResolvedValue([]);
    productFindMany.mockResolvedValue([]);
    catalogTagFindMany.mockResolvedValue([]);
    collectionFindMany.mockResolvedValue([]);
    blogPostFindMany.mockResolvedValue([]);

    service = new SearchPublicService(new PrismaService() as never);
  });

  it('q < 2 → пустые groups без запросов', async () => {
    const res = await service.search('а');
    expect(res.groups).toEqual([]);
    expect(productFindMany).not.toHaveBeenCalled();
  });

  it('товары ищутся по sku / nationalCatalogName / оттенкам / shortDescription', async () => {
    await service.search('nude');
    expect(productFindMany).toHaveBeenCalled();
    const where = productFindMany.mock.calls[0]![0].where;
    expect(where.active).toBe(true);
    const or = where.OR as unknown[];
    expect(or.length).toBeGreaterThan(3);
    const blob = JSON.stringify(where);
    expect(blob).toContain('shortDescription');
    expect(blob).toContain('sku');
    expect(blob).toContain('nationalCatalogName');
    expect(blob).toContain('shades');
  });

  it('теги и категории фильтруют active products', async () => {
    await service.search('лицо');
    const tagWhere = catalogTagFindMany.mock.calls[0]![0].where;
    expect(JSON.stringify(tagWhere)).toContain('"active":true');
    const catWhere = categoryFindMany.mock.calls[0]![0].where;
    expect(JSON.stringify(catWhere)).toContain('"active":true');
  });

  it('ранжирует товары: prefix выше contains', async () => {
    productFindMany.mockResolvedValueOnce([
      {
        id: '2',
        name: 'Ночной крем',
        slug: 'night',
        images: [],
        variants: [{ price: 1000 }],
      },
      {
        id: '1',
        name: 'Крем дневной',
        slug: 'day',
        images: [],
        variants: [{ price: 900 }],
      },
    ]);
    const res = await service.search('крем');
    const products = res.groups.find((g) => g.key === 'product');
    expect(products?.items.map((i) => i.id)).toEqual(['1', '2']);
    expect(products?.items[0]?.subtitle).toBe('900 р.');
  });

  it('subtitle «от …» при разбросе цен', async () => {
    productFindMany.mockResolvedValueOnce([
      {
        id: '1',
        name: 'Крем',
        slug: 'k',
        images: [],
        variants: [{ price: 500 }, { price: 900 }],
      },
    ]);
    const res = await service.search('крем');
    expect(res.groups[0]?.items[0]?.subtitle).toBe('от 500 р.');
  });
});
