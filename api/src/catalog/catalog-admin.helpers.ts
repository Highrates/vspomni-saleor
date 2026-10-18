import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type NullableStr = string | null | undefined;

export function trimOrNull(v: NullableStr): string | null {
  if (v === undefined || v === null) return null;
  const t = v.trim();
  return t || null;
}

/** SEO canonical path — относительный URL, начинается с /. */
export function normalizeCanonicalPath(v: NullableStr): string | null {
  const t = trimOrNull(v);
  if (!t) return null;
  const path = t.startsWith('/') ? t : `/${t}`;
  if (!path.startsWith('/')) {
    throw new BadRequestException('canonicalPath должен начинаться с /');
  }
  return path;
}

export function dedupeIdsPreserveOrder(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const t = typeof id === 'string' ? id.trim() : '';
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Подписи ароматов на карточке: trim, без пустых, сохраняем порядок, max 12. */
export function normalizeCardAromaLabels(
  raw: string[] | null | undefined,
): string[] {
  if (!raw?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const t = typeof item === 'string' ? item.trim() : '';
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t.slice(0, 80));
    if (out.length >= 12) break;
  }
  return out;
}

/** Используется коллекциями и наборами товаров при валидации productIds. */
export async function assertProductsExist(
  prisma: Pick<PrismaService, 'product'>,
  ids: string[],
) {
  if (!ids.length) return;
  const n = await prisma.product.count({ where: { id: { in: ids } } });
  if (n !== ids.length) throw new BadRequestException('Один из товаров не найден');
}
