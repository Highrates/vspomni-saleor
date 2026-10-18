import { getServerApiBase } from '@/lib/serverApiBase';
import { cache } from 'react';

export type PublicCmsPage = {
  slug: string;
  title: string;
  bodyHtml: string;
  updatedAt: string;
};

const CMS_REVALIDATE = 120;

async function cmsGet(slug: string): Promise<PublicCmsPage | null> {
  const url = `${getServerApiBase()}/cms/pages/${encodeURIComponent(slug)}`;
  try {
    const res = await fetch(url, {
      next: {
        revalidate: CMS_REVALIDATE,
        tags: ['cms', `cms:${slug}`],
      },
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      console.error(`[cms] GET ${slug} → ${res.status}`);
      return null;
    }
    return (await res.json()) as PublicCmsPage;
  } catch (err) {
    console.error(`[cms] GET ${slug} failed`, err);
    return null;
  }
}

export const fetchPublicCmsPage = cache(async (slug: string) => cmsGet(slug));
