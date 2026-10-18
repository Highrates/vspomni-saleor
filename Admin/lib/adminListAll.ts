import { adminBackendJson } from './adminBackendFetch';

type PageResponse<T> = {
  items: T[];
  total: number;
  page?: number;
  limit?: number;
};

/**
 * Тянет все страницы списка, чтобы не обрезать при лимите бэка (100/500).
 */
export async function adminBackendListAllPages<T>(
  path: string,
  opts?: { q?: string; pageSize?: number },
): Promise<T[]> {
  const pageSize = Math.min(100, Math.max(1, opts?.pageSize ?? 100));
  const out: T[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;

  while (out.length < total) {
    const sp = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
    });
    if (opts?.q?.trim()) sp.set('q', opts.q.trim());
    const sep = path.includes('?') ? '&' : '?';
    const res = await adminBackendJson<PageResponse<T>>(`${path}${sep}${sp}`);
    total = res.total;
    out.push(...res.items);
    if (!res.items.length) break;
    page += 1;
    if (page > 200) break;
  }

  return out;
}
