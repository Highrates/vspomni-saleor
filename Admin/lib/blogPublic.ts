export type PublicBlogCategory = {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
};

export type PublicBlogPostCard = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  publishedAt: string | null;
  category: { id: string; slug: string; name: string } | null;
};

export type PublicBlogPostsResponse = {
  items: PublicBlogPostCard[];
  total: number;
  page: number;
  limit: number;
};

export type PublicBlogPostDetail = PublicBlogPostCard & {
  body: string;
  author: { id: string; displayName: string | null } | null;
};

export function formatBlogDateRu(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

/** Размер страницы списка на витрине блога. */
export const BLOG_LIST_PAGE_SIZE = 24;
