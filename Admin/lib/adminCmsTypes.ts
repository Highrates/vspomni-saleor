/** Админ CMS / юр. страницы (privacy, terms, delivery). */

export const LEGAL_SLUGS = ['privacy', 'terms', 'delivery'] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export function isLegalSlug(slug: string): slug is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(slug);
}

/** Ответ GET/PUT cms/admin/pages/:slug (синтетика до первого save — id null). */
export type AdminCmsPage = {
  id: string | null;
  slug: string;
  title: string;
  bodyHtml: string;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

/** Строка списка cms/admin/legal. */
export type AdminCmsLegalRow = {
  id: string | null;
  slug: string;
  title: string;
  isPublished: boolean;
  updatedAt: string | null;
};
