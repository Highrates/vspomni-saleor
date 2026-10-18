import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizeBlogPostBodyHtml } from './blog-html.util';
import { parseOptionalPositiveInt } from '../common/parse-positive-int';

export type BlogListPostsResult = {
  items: unknown[];
  total: number;
  page: number;
  limit: number;
  /** categorySlug передан, но рубрика не найдена */
  categoryMissing?: boolean;
};

function publishedVisibleWhere(): Prisma.BlogPostWhereInput {
  const now = new Date();
  return {
    isPublished: true,
    OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
  };
}

@Injectable()
export class BlogPublicService {
  constructor(private readonly prisma: PrismaService) {}

  /** Только рубрики, в которых есть хотя бы одна видимая на витрине статья. */
  async listCategories() {
    return this.prisma.blogCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      where: {
        posts: { some: publishedVisibleWhere() },
      },
      select: { id: true, slug: true, name: true, sortOrder: true },
    });
  }

  async listPosts(params: {
    categoryId?: string;
    categorySlug?: string;
    page?: number;
    limit?: number;
  }): Promise<BlogListPostsResult> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(Math.max(1, params.limit ?? 20), 100);
    let categoryId = params.categoryId?.trim() || undefined;
    const slug = params.categorySlug?.trim();

    if (!categoryId && slug) {
      const cat = await this.prisma.blogCategory.findFirst({
        where: { slug },
        select: { id: true },
      });
      if (!cat) {
        return { items: [], total: 0, page, limit, categoryMissing: true };
      }
      categoryId = cat.id;
    }

    const where: Prisma.BlogPostWhereInput = {
      ...publishedVisibleWhere(),
      ...(categoryId ? { categoryId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.blogPost.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          coverUrl: true,
          publishedAt: true,
          sortOrder: true,
          category: { select: { id: true, slug: true, name: true } },
        },
      }),
      this.prisma.blogPost.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async getPostBySlug(slug: string) {
    const s = slug.trim();
    if (!s) return null;
    const now = new Date();
    const row = await this.prisma.blogPost.findFirst({
      where: {
        slug: s,
        isPublished: true,
        OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
      },
      include: { category: true, author: { select: { id: true, displayName: true } } },
    });
    if (!row) return null;
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      body: sanitizeBlogPostBodyHtml(row.body),
      coverUrl: row.coverUrl,
      metaTitle: row.metaTitle,
      metaDescription: row.metaDescription,
      ogImageUrl: row.ogImageUrl,
      canonicalPath: row.canonicalPath,
      seoNoIndex: row.seoNoIndex,
      publishedAt: row.publishedAt,
      category: row.category
        ? { id: row.category.id, slug: row.category.slug, name: row.category.name }
        : null,
      author: row.author
        ? { id: row.author.id, displayName: row.author.displayName }
        : null,
    };
  }
}

/** Helper for controller query parsing (keeps controller thin). */
export function parseBlogListQuery(raw: {
  categoryId?: string;
  categorySlug?: string;
  page?: string;
  limit?: string;
}) {
  return {
    categoryId: raw.categoryId,
    categorySlug: raw.categorySlug,
    page: parseOptionalPositiveInt(raw.page),
    limit: parseOptionalPositiveInt(raw.limit),
  };
}
