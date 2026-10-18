export type AdminBlogCategoryRow = {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  postCount?: number;
};

export type AdminBlogPostListItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  sortOrder: number;
  category: { id: string; name: string; slug: string } | null;
};

export type AdminBlogPostsListResponse = {
  items: AdminBlogPostListItem[];
  total: number;
  page: number;
  limit: number;
};

export type AdminBlogPostDetail = AdminBlogPostListItem & {
  body: string;
  categoryId: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImageUrl: string | null;
  canonicalPath: string | null;
  seoNoIndex: boolean;
  createdAt: string;
  updatedAt: string;
};
