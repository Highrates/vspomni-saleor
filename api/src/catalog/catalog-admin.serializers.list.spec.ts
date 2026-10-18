import { describe, expect, it } from 'vitest';
import { serializeProductListItem } from './catalog-admin.serializers';

const base = {
  id: 'p1',
  name: 'Крем',
  slug: 'krem',
  categoryId: 'c1',
  active: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  category: {
    id: 'c1',
    name: 'Лицо',
    slug: 'litso',
    parentId: null,
    parent: null,
  },
};

describe('serializeProductListItem', () => {
  it('лёгкая проекция: без HTML / variants gallery', () => {
    const row = serializeProductListItem({
      ...base,
      variants: [
        {
          id: 'v1',
          sku: 'krem-50',
          price: 1200,
          stock: 10,
          stockReserve: 2,
          active: true,
        },
      ],
      images: [{ url: 'https://cdn/x.jpg', mediaType: 'image' }],
    });

    expect(row).toMatchObject({
      id: 'p1',
      name: 'Крем',
      slug: 'krem',
      coverImageUrl: 'https://cdn/x.jpg',
      coverMediaType: 'image',
      primarySku: 'krem-50',
      variantCount: 1,
      minPrice: 1200,
      stockTotal: 8,
    });
    expect(row).not.toHaveProperty('descriptionHtml');
    expect(row).not.toHaveProperty('variants');
    expect(row).not.toHaveProperty('images');
    expect(row).not.toHaveProperty('catalogTagIds');
  });

  it('minPrice только по active; fallback на все если active нет', () => {
    const withActive = serializeProductListItem({
      ...base,
      variants: [
        { id: 'v1', sku: 'a', price: 500, stock: 1, stockReserve: 0, active: false },
        { id: 'v2', sku: 'b', price: 900, stock: 1, stockReserve: 0, active: true },
        { id: 'v3', sku: 'c', price: 300, stock: 1, stockReserve: 0, active: false },
      ],
      images: [],
    });
    expect(withActive.minPrice).toBe(900);
    expect(withActive.primarySku).toBe('b');

    const onlyInactive = serializeProductListItem({
      ...base,
      variants: [
        { id: 'v1', sku: 'a', price: 500, stock: 1, stockReserve: 0, active: false },
        { id: 'v2', sku: 'c', price: 300, stock: 1, stockReserve: 0, active: false },
      ],
      images: [],
    });
    expect(onlyInactive.minPrice).toBe(300);
  });

  it('stockTotal = stock − reserve (≥ 0) по active', () => {
    const row = serializeProductListItem({
      ...base,
      variants: [
        { id: 'v1', sku: 'a', price: 100, stock: 5, stockReserve: 5, active: true },
        { id: 'v2', sku: 'b', price: 100, stock: 3, stockReserve: 1, active: true },
        { id: 'v3', sku: 'c', price: 100, stock: 100, stockReserve: 0, active: false },
      ],
      images: [],
    });
    expect(row.stockTotal).toBe(0 + 2);
  });

  it('coverMediaType video при mediaType=video', () => {
    const row = serializeProductListItem({
      ...base,
      variants: [],
      images: [{ url: 'https://cdn/x.mp4', mediaType: 'video' }],
    });
    expect(row.coverMediaType).toBe('video');
    expect(row.coverImageUrl).toBe('https://cdn/x.mp4');
  });
});
