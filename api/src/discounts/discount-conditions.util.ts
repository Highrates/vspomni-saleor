import { DiscountRewardType } from '@prisma/client';

export const DISCOUNT_CONDITION_KINDS = ['MIN_QTY', 'MIN_AMOUNT', 'MIN_LINES'] as const;
export type DiscountConditionKind = (typeof DISCOUNT_CONDITION_KINDS)[number];

export type DiscountConditionItem = {
  kind: DiscountConditionKind;
  value: number;
};

export type DiscountConditions = {
  logic: 'AND' | 'OR';
  items: DiscountConditionItem[];
};

export class DiscountConditionsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscountConditionsError';
  }
}

export function assertRewardValue(type: DiscountRewardType, value: number): string | null {
  if (!Number.isInteger(value) || value < 1) {
    return 'Значение вознаграждения: целое число ≥ 1';
  }
  if (type === DiscountRewardType.PERCENT && value > 100) {
    return 'Процент скидки: от 1 до 100';
  }
  return null;
}

/**
 * null/undefined/пустой items → null (без условий).
 * Любой битый или дублирующий kind → DiscountConditionsError (reject всего payload).
 */
export function normalizeConditions(
  raw: { logic?: string; items?: { kind?: string; value?: number }[] } | null | undefined,
): DiscountConditions | null {
  if (raw == null) return null;
  const rawItems = raw.items ?? [];
  if (!rawItems.length) return null;

  const seen = new Set<DiscountConditionKind>();
  const items: DiscountConditionItem[] = [];

  for (const it of rawItems) {
    if (!it || !DISCOUNT_CONDITION_KINDS.includes(it.kind as DiscountConditionKind)) {
      throw new DiscountConditionsError('Некорректный тип условия');
    }
    const kind = it.kind as DiscountConditionKind;
    if (seen.has(kind)) {
      throw new DiscountConditionsError(`Дубликат типа условия: ${kind}`);
    }
    seen.add(kind);
    const value = Number(it.value);
    if (!Number.isInteger(value) || value < 1) {
      throw new DiscountConditionsError('Значение условия: целое число ≥ 1');
    }
    items.push({ kind, value });
  }

  return {
    logic: raw.logic === 'OR' ? 'OR' : 'AND',
    items,
  };
}
