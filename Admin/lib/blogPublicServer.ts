import { cache } from 'react';
import { getServerApiBase } from './serverApiBase';
import type {
  PublicBlogCategory,
  PublicBlogPostCard,
  PublicBlogPostDetail,
  PublicBlogPostsResponse,
} from './blogPublic';
import { BLOG_LIST_PAGE_SIZE } from './blogPublic';

const BLOG_REVALIDATE_SECONDS = 120;
const BLOG_FETCH_TAGS = ['blog'] as const;

async function blogGet<T>(path: string): Promise<T | null> {
  const url = `${getServerApiBase()}/blog/${path.replace(/^\//, '')}`;
  try {
    const res = await fetch(url, {
      next: { revalidate: BLOG_REVALIDATE_SECONDS, tags: [...BLOG_FETCH_TAGS] },
      headers: { Accept: 'application/json' },
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchBlogCategoriesPublic(): Promise<PublicBlogCategory[]> {
  const data = await blogGet<PublicBlogCategory[]>('categories');
  return data ?? [];
}

export async function fetchBlogPostsPublic(opts: {
  categorySlug?: string;
  page?: number;
  limit?: number;
}): Promise<PublicBlogPostsResponse> {
  const limit = opts.limit ?? BLOG_LIST_PAGE_SIZE;
  const qs = new URLSearchParams();
  if (opts.categorySlug) qs.set('categorySlug', opts.categorySlug);
  qs.set('page', String(opts.page ?? 1));
  qs.set('limit', String(limit));
  const empty: PublicBlogPostsResponse = { items: [], total: 0, page: 1, limit };
  const data = await blogGet<PublicBlogPostsResponse>(`posts?${qs}`);
  return data ?? empty;
}

/**
 * SSR deep-link `?page=N`: один запрос с limit = pageSize * N (≤100),
 * вместо N последовательных page=1..N.
 */
export async function fetchBlogPostsThroughPages(opts: {
  categorySlug?: string;
  throughPage: number;
  pageSize?: number;
}): Promise<{
  items: PublicBlogPostCard[];
  total: number;
  limit: number;
  loadedPages: number;
}> {
  const limit = opts.pageSize ?? BLOG_LIST_PAGE_SIZE;
  const raw = Math.floor(Number(opts.throughPage));
  const requested = Number.isFinite(raw) && raw >= 1 ? raw : 1;
  const throughPage = Math.min(requested, 20);
  const take = Math.min(100, limit * throughPage);

  const batch = await fetchBlogPostsPublic({
    categorySlug: opts.categorySlug,
    page: 1,
    limit: take,
  });

  const loadedPages = Math.min(
    throughPage,
    Math.max(1, Math.ceil(batch.items.length / limit) || 1),
  );

  return {
    items: batch.items,
    total: batch.total,
    limit,
    loadedPages,
  };
}

export const loadBlogPostBySlug = cache(async (slug: string): Promise<PublicBlogPostDetail | null> => {
  return blogGet<PublicBlogPostDetail>(`posts/${encodeURIComponent(slug)}`);
});
