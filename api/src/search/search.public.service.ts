import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { catalogSellablePrices } from '../catalog/catalog-price.util';
import { PrismaService } from '../prisma/prisma.service';

function formatRub(value: number): string {
  return `${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} р.`;
}

/** Нормализация для ранжирования: lower + ё→е. */
export function normalizeSearchText(s: string): string {
  return s.trim().toLowerCase().replace(/ё/g, 'е');
}

/** Варианты строки для ILIKE (оригинал + без ё). */
export function searchForms(q: string): string[] {
  const trimmed = q.trim();
  if (!trimmed) return [];
  const deyo = trimmed.replace(/ё/g, 'е').replace(/Ё/g, 'Е');
  return deyo === trimmed ? [trimmed] : [trimmed, deyo];
}

/**
 * Лёгкий score без FTS/морфологии/опечаток:
 * exact > prefix > token-all > contains.
 */
export function scoreTitleMatch(title: string, q: string): number {
  const t = normalizeSearchText(title);
  const nq = normalizeSearchText(q);
  if (!nq || !t) return 0;
  if (t === nq) return 100;
  if (t.startsWith(nq)) return 80;
  const tokens = nq.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every((tok) => t.includes(tok))) return 55;
  if (t.includes(nq)) return 40;
  return 10;
}

function containsInsensitive(form: string): Prisma.StringFilter {
  return { contains: form, mode: 'insensitive' };
}

function nameMatchesAnyForm(
  forms: string[],
): Array<{ name: Prisma.StringFilter }> {
  return forms.map((f) => ({ name: containsInsensitive(f) }));
}

export type SearchHit = {
  id: string;
  title: string;
  href: string;
  subtitle?: string | null;
  imageUrl?: string | null;
};

export type SearchGroup = {
  key: 'category' | 'product' | 'tag' | 'collection' | 'blog';
  label: string;
  items: SearchHit[];
};

const PRODUCT_TAKE = 24;
const PRODUCT_LIMIT = 10;
const CATEGORY_TAKE = 16;
const CATEGORY_LIMIT = 8;
const TAG_TAKE = 12;
const TAG_LIMIT = 6;
const COLLECTION_TAKE = 12;
const COLLECTION_LIMIT = 6;
const BLOG_TAKE = 16;
const BLOG_LIMIT = 8;

@Injectable()
export class SearchPublicService {
  constructor(private readonly prisma: PrismaService) {}

  async search(qRaw: string): Promise<{ q: string; groups: SearchGroup[] }> {
    const q = qRaw.trim().slice(0, 80);
    const forms = searchForms(q);
    if (q.length < 2 || forms.length === 0) {
      return { q, groups: [] };
    }

    const hasActiveProducts: Prisma.CategoryWhereInput = {
      OR: [
        { products: { some: { active: true } } },
        {
          children: {
            some: { products: { some: { active: true } } },
          },
        },
      ],
    };

    const productOr: Prisma.ProductWhereInput[] = [];
    for (const f of forms) {
      const c = containsInsensitive(f);
      productOr.push(
        { name: c },
        { slug: c },
        { shortDescription: c },
        {
          variants: {
            some: {
              OR: [
                { sku: c },
                { nationalCatalogName: c },
                { name: c },
                { shades: { some: { name: c } } },
              ],
            },
          },
        },
      );
    }

    const [categories, products, tags, collections, posts] = await Promise.all([
      this.prisma.category.findMany({
        where: {
          AND: [{ OR: nameMatchesAnyForm(forms) }, hasActiveProducts],
        },
        take: CATEGORY_TAKE,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          slug: true,
          parentId: true,
          parent: { select: { slug: true, name: true } },
        },
      }),
      this.prisma.product.findMany({
        where: {
          active: true,
          excludeFromCatalog: false,
          OR: productOr,
        },
        take: PRODUCT_TAKE,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          slug: true,
          images: {
            take: 1,
            orderBy: { sortOrder: 'asc' },
            select: { url: true },
          },
          variants: {
            where: { active: true },
            select: { price: true },
            orderBy: { price: 'asc' },
            take: 20,
          },
        },
      }),
      this.prisma.catalogTag.findMany({
        where: {
          AND: [
            { OR: nameMatchesAnyForm(forms) },
            {
              products: {
                some: { product: { active: true } },
              },
            },
          ],
        },
        take: TAG_TAKE,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          slug: true,
          coverImageUrl: true,
        },
      }),
      this.prisma.collection.findMany({
        where: {
          active: true,
          OR: forms.flatMap((f) => {
            const c = containsInsensitive(f);
            return [{ name: c }, { slug: c }];
          }),
        },
        take: COLLECTION_TAKE,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          slug: true,
          shortDescription: true,
          coverImageUrl: true,
        },
      }),
      this.prisma.blogPost.findMany({
        where: {
          isPublished: true,
          OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
          AND: [
            {
              OR: forms.flatMap((f) => {
                const c = containsInsensitive(f);
                return [{ title: c }, { excerpt: c }];
              }),
            },
          ],
        },
        take: BLOG_TAKE,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          coverUrl: true,
          category: { select: { name: true } },
        },
      }),
    ]);

    const groups: SearchGroup[] = [];

    const rankedCategories = [...categories]
      .sort((a, b) => scoreTitleMatch(b.name, q) - scoreTitleMatch(a.name, q))
      .slice(0, CATEGORY_LIMIT);
    if (rankedCategories.length) {
      groups.push({
        key: 'category',
        label: 'Каталог',
        items: rankedCategories.map((c) => {
          const href = c.parent
            ? `/catalog/${encodeURIComponent(c.parent.slug)}/${encodeURIComponent(c.slug)}`
            : `/catalog/${encodeURIComponent(c.slug)}`;
          return {
            id: c.id,
            title: c.name,
            href,
            subtitle: c.parent?.name ?? null,
          };
        }),
      });
    }

    const rankedProducts = [...products]
      .sort((a, b) => scoreTitleMatch(b.name, q) - scoreTitleMatch(a.name, q))
      .slice(0, PRODUCT_LIMIT);
    if (rankedProducts.length) {
      groups.push({
        key: 'product',
        label: 'Товар',
        items: rankedProducts.map((p) => {
          const prices = catalogSellablePrices(p.variants);
          const min = prices.length ? Math.min(...prices) : null;
          const max = prices.length ? Math.max(...prices) : null;
          let subtitle: string | null = null;
          if (min != null) {
            const formatted = formatRub(min);
            subtitle = max != null && max > min ? `от ${formatted}` : formatted;
          }
          return {
            id: p.id,
            title: p.name,
            href: `/product/${encodeURIComponent(p.slug)}`,
            subtitle,
            imageUrl: p.images[0]?.url ?? null,
          };
        }),
      });
    }

    const rankedTags = [...tags]
      .sort((a, b) => scoreTitleMatch(b.name, q) - scoreTitleMatch(a.name, q))
      .slice(0, TAG_LIMIT);
    if (rankedTags.length) {
      groups.push({
        key: 'tag',
        label: 'Зона',
        items: rankedTags.map((t) => ({
          id: t.id,
          title: t.name,
          href: `/catalog?tag=${encodeURIComponent(t.slug)}`,
          imageUrl: t.coverImageUrl,
        })),
      });
    }

    const rankedCollections = [...collections]
      .sort((a, b) => scoreTitleMatch(b.name, q) - scoreTitleMatch(a.name, q))
      .slice(0, COLLECTION_LIMIT);
    if (rankedCollections.length) {
      groups.push({
        key: 'collection',
        label: 'Коллекция',
        items: rankedCollections.map((c) => ({
          id: c.id,
          title: c.name,
          href: `/catalog?collection=${encodeURIComponent(c.slug)}`,
          subtitle: c.shortDescription,
          imageUrl: c.coverImageUrl,
        })),
      });
    }

    const rankedPosts = [...posts]
      .sort((a, b) => scoreTitleMatch(b.title, q) - scoreTitleMatch(a.title, q))
      .slice(0, BLOG_LIMIT);
    if (rankedPosts.length) {
      groups.push({
        key: 'blog',
        label: 'Блог',
        items: rankedPosts.map((p) => ({
          id: p.id,
          title: p.title,
          href: `/articles/${encodeURIComponent(p.slug)}`,
          subtitle: p.category?.name ?? p.excerpt ?? null,
          imageUrl: p.coverUrl,
        })),
      });
    }

    return { q, groups };
  }
}
