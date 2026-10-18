import { getServerApiBase } from '@/lib/serverApiBase';
import type { PublicProductCard } from '@/lib/publicCatalog';
import { cache } from 'react';

export type PublicHomepageSet = {
  id: string;
  imageUrl: string;
  slug: string;
  name: string;
  product: PublicProductCard;
};

export type PublicHomepageSetsResult = {
  items: PublicHomepageSet[];
  ok: boolean;
};

const HOMEPAGE_SETS_REVALIDATE = 120;
const HOMEPAGE_SETS_TAGS = ['homepage-sets'] as const;

async function homepageSetsGet<T>(path: string): Promise<{ data: T | null; ok: boolean }> {
  const url = `${getServerApiBase()}/${path.replace(/^\//, '')}`;
  try {
    const res = await fetch(url, {
      next: {
        revalidate: HOMEPAGE_SETS_REVALIDATE,
        tags: [...HOMEPAGE_SETS_TAGS],
      },
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      console.error(`[homepage-sets] GET ${path} → ${res.status}`);
      return { data: null, ok: false };
    }
    return { data: (await res.json()) as T, ok: true };
  } catch (err) {
    console.error(`[homepage-sets] GET ${path} failed`, err);
    return { data: null, ok: false };
  }
}

export const fetchPublicHomepageSets = cache(async (): Promise<PublicHomepageSetsResult> => {
  const { data, ok } = await homepageSetsGet<{ items: PublicHomepageSet[] }>(
    'settings/homepage-sets',
  );
  if (!ok) return { items: [], ok: false };
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    ok: true,
  };
});
