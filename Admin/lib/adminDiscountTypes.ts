export type DiscountRuntimeStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'RUNNING'
  | 'EXPIRED'
  | 'OFF';

export type DiscountScope = 'CATEGORY' | 'PRODUCTS';
export type DiscountRewardType = 'PERCENT' | 'FIXED';

export type DiscountConditionKind = 'MIN_QTY' | 'MIN_AMOUNT' | 'MIN_LINES';

export type DiscountConditionItem = {
  kind: DiscountConditionKind;
  value: number;
};

export type DiscountConditions = {
  logic: 'AND' | 'OR';
  items: DiscountConditionItem[];
};

export type AdminDiscountRule = {
  id?: string;
  name: string;
  conditions: DiscountConditions | null;
  description: string | null;
  rewardType: DiscountRewardType;
  rewardValue: number;
  sortOrder?: number;
};

export type AdminDiscountListItem = {
  id: string;
  name: string;
  scope: DiscountScope;
  active: boolean;
  status: DiscountRuntimeStatus;
  startsAt: string;
  endsAt: string | null;
  ruleCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminDiscountListResponse = {
  items: AdminDiscountListItem[];
  total: number;
  page: number;
  limit: number;
};

export type AdminDiscountDetail = {
  id: string;
  name: string;
  description: string | null;
  scope: DiscountScope;
  active: boolean;
  status: DiscountRuntimeStatus;
  startsAt: string;
  endsAt: string | null;
  categoryIds: string[];
  categories: {
    id: string;
    name: string;
    slug: string;
    parentId: string | null;
    parentName: string | null;
  }[];
  productIds: string[];
  products: { id: string; name: string; slug: string }[];
  rules: AdminDiscountRule[];
  createdAt: string;
  updatedAt: string;
};

export const DISCOUNT_CONDITION_KIND_LABELS: Record<DiscountConditionKind, string> = {
  MIN_QTY: 'Мин. количество товаров',
  MIN_AMOUNT: 'Мин. сумма, ₽',
  MIN_LINES: 'Мин. разных позиций',
};

export const DISCOUNT_STATUS_LABELS: Record<DiscountRuntimeStatus, string> = {
  DRAFT: 'Черновик',
  SCHEDULED: 'Запланирована',
  RUNNING: 'Идёт',
  EXPIRED: 'Истекла',
  OFF: 'Выкл.',
};

/** Derived-статус кампании (как на бэке). */
export function deriveDiscountStatus(opts: {
  active: boolean;
  startsAt: string | Date;
  endsAt: string | Date | null;
  ruleCount: number;
  now?: Date;
}): DiscountRuntimeStatus {
  if (!opts.active) return 'OFF';
  if (opts.ruleCount <= 0) return 'DRAFT';
  const now = (opts.now ?? new Date()).getTime();
  const starts = new Date(opts.startsAt).getTime();
  if (Number.isNaN(starts) || now < starts) return 'SCHEDULED';
  if (opts.endsAt != null && String(opts.endsAt).trim() !== '') {
    const ends = new Date(opts.endsAt).getTime();
    if (!Number.isNaN(ends) && now > ends) return 'EXPIRED';
  }
  return 'RUNNING';
}

export function discountStatusBadgeClass(
  status: DiscountRuntimeStatus,
  styles: Record<string, string>,
): string {
  switch (status) {
    case 'RUNNING':
      return styles.badgeOn ?? '';
    case 'SCHEDULED':
      return styles.badgeScheduled ?? '';
    case 'DRAFT':
      return styles.badgeDraft ?? '';
    case 'EXPIRED':
      return styles.badgeExpired ?? '';
    case 'OFF':
    default:
      return styles.badgeOff ?? '';
  }
}
