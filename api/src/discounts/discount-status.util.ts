import type { Discount, Prisma } from '@prisma/client';

export type DiscountRuntimeStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'RUNNING'
  | 'EXPIRED'
  | 'OFF';

/** Производный статус кампании: active ≠ «идёт сейчас». */
export function deriveDiscountStatus(
  row: Pick<Discount, 'active' | 'startsAt' | 'endsAt'> & { ruleCount: number },
  now: Date = new Date(),
): DiscountRuntimeStatus {
  if (!row.active) return 'OFF';
  if (row.ruleCount <= 0) return 'DRAFT';
  const t = now.getTime();
  if (t < row.startsAt.getTime()) return 'SCHEDULED';
  if (row.endsAt && t > row.endsAt.getTime()) return 'EXPIRED';
  return 'RUNNING';
}

/** Prisma where для derived status (list filters). */
export function discountStatusWhere(
  status: DiscountRuntimeStatus,
  now: Date = new Date(),
): Prisma.DiscountWhereInput {
  switch (status) {
    case 'OFF':
      return { active: false };
    case 'DRAFT':
      return { active: true, rules: { none: {} } };
    case 'SCHEDULED':
      return {
        active: true,
        startsAt: { gt: now },
        rules: { some: {} },
      };
    case 'RUNNING':
      return {
        active: true,
        startsAt: { lte: now },
        AND: [
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          { rules: { some: {} } },
        ],
      };
    case 'EXPIRED':
      return {
        active: true,
        endsAt: { lt: now },
        rules: { some: {} },
      };
    default:
      return {};
  }
}
