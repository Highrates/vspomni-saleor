import { BadRequestException } from '@nestjs/common';
import { toRelativeMediaPath } from '@vspomni/media-path';
import { PrismaService } from '../prisma/prisma.service';

type NullableStr = string | null | undefined;

export function trimOrNull(v: NullableStr): string | null {
  if (v === undefined || v === null) return null;
  const t = v.trim();
  return t || null;
}

/** Display name (trim, max 200) + case-insensitive key for AromaNoteDefinition. */
export function normalizeAromaNoteName(raw: string): {
  name: string;
  nameNormalized: string;
} {
  const name = raw.trim().slice(0, 200);
  return {
    name,
    nameNormalized: name.toLocaleLowerCase('ru'),
  };
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

/**
 * Дата «Выбор ⭐» (день без времени).
 * `undefined` — поле не трогаем; `null`/пусто — очистить; иначе Date (UTC noon).
 */
export function parseOptionalDateOnly(
  v: string | null | undefined,
): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) {
      throw new BadRequestException('Некорректная дата «Выбор ⭐»');
    }
    return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  }
  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('Некорректная дата «Выбор ⭐»');
  }
  return parsed;
}

/** Absolute Nest URL → `/uploads/…` для хранения в БД. */
export function normalizeStoredUploadUrl(v: string | null): string | null {
  if (!v) return null;
  const rel = toRelativeMediaPath(v);
  return rel || v;
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
