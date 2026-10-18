import { getServerApiBase } from '@/lib/serverApiBase';
import { cache } from 'react';

export type PublicFaqItem = {
  id: string;
  question: string;
  answer: string;
};

export type PublicFaqResult = {
  items: PublicFaqItem[];
  /** false = Nest/сеть недоступны; не путать с пустым FAQ */
  ok: boolean;
};

const FAQ_REVALIDATE = 120;
const FAQ_TAGS = ['faq'] as const;

async function faqGet<T>(path: string): Promise<{ data: T | null; ok: boolean }> {
  const url = `${getServerApiBase()}/${path.replace(/^\//, '')}`;
  try {
    const res = await fetch(url, {
      next: {
        revalidate: FAQ_REVALIDATE,
        tags: [...FAQ_TAGS],
      },
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      console.error(`[faq] GET ${path} → ${res.status}`);
      return { data: null, ok: false };
    }
    return { data: (await res.json()) as T, ok: true };
  } catch (err) {
    console.error(`[faq] GET ${path} failed`, err);
    return { data: null, ok: false };
  }
}

export const fetchPublicFaq = cache(async (): Promise<PublicFaqResult> => {
  const { data, ok } = await faqGet<{ items: PublicFaqItem[] }>('settings/faq');
  if (!ok) return { items: [], ok: false };
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    ok: true,
  };
});
