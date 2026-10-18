import { getServerApiBase } from '@/lib/serverApiBase';
import { cache } from 'react';

export type PublicHeroSlide = {
  id: string;
  imageUrl: string;
  mobileImageUrl: string | null;
  href?: string | null;
};

export type PublicHeroResult = {
  items: PublicHeroSlide[];
  ok: boolean;
};

const HERO_REVALIDATE = 120;
const HERO_TAGS = ['hero'] as const;

async function heroGet<T>(path: string): Promise<{ data: T | null; ok: boolean }> {
  const url = `${getServerApiBase()}/${path.replace(/^\//, '')}`;
  try {
    const res = await fetch(url, {
      next: {
        revalidate: HERO_REVALIDATE,
        tags: [...HERO_TAGS],
      },
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      console.error(`[hero] GET ${path} → ${res.status}`);
      return { data: null, ok: false };
    }
    return { data: (await res.json()) as T, ok: true };
  } catch (err) {
    console.error(`[hero] GET ${path} failed`, err);
    return { data: null, ok: false };
  }
}

export const fetchPublicHero = cache(async (): Promise<PublicHeroResult> => {
  const { data, ok } = await heroGet<{ items: PublicHeroSlide[] }>('settings/hero');
  if (!ok) return { items: [], ok: false };
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    ok: true,
  };
});
