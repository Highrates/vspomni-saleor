import { DiscountRewardType, DiscountScope } from '@prisma/client';
import {
  type DiscountConditions,
  normalizeConditions,
} from './discount-conditions.util';

export type PricingLineIn = {
  key: string;
  productId: string;
  categoryId: string;
  qty: number;
  /** Сырая цена варианта (₽) */
  listPrice: number;
};

export type CampaignRuleIn = {
  id: string;
  sortOrder: number;
  conditions: unknown;
  rewardType: DiscountRewardType;
  rewardValue: number;
};

export type CampaignIn = {
  id: string;
  name: string;
  startsAt: Date;
  scope: DiscountScope;
  categoryIds: string[];
  productIds: string[];
  rules: CampaignRuleIn[];
};

export type PricingLineOut = PricingLineIn & {
  /** Unit price после каталожной скидки */
  price: number;
  /** Сумма скидки по строке (₽) */
  lineDiscount: number;
  discountId: string | null;
  discountName: string | null;
};

export type CartPricingResult = {
  lines: PricingLineOut[];
  /** Сумма listPrice×qty */
  listSubtotal: number;
  /** Сумма после кампаний */
  subtotal: number;
  campaignDiscountTotal: number;
};

type ScopeAgg = {
  qty: number;
  amount: number;
  lineCount: number;
};

function lineTotal(l: PricingLineIn): number {
  return l.listPrice * l.qty;
}

function inScope(c: CampaignIn, l: PricingLineIn): boolean {
  if (c.scope === DiscountScope.PRODUCTS) {
    return c.productIds.includes(l.productId);
  }
  return c.categoryIds.includes(l.categoryId);
}

function scopeAgg(lines: PricingLineIn[]): ScopeAgg {
  return {
    qty: lines.reduce((s, l) => s + l.qty, 0),
    amount: lines.reduce((s, l) => s + lineTotal(l), 0),
    lineCount: lines.length,
  };
}

function conditionsPass(raw: unknown, agg: ScopeAgg): boolean {
  let cond: DiscountConditions | null;
  try {
    cond = normalizeConditions(
      raw as { logic?: string; items?: { kind?: string; value?: number }[] } | null,
    );
  } catch {
    return false;
  }
  if (!cond?.items.length) return true;

  const checks = cond.items.map((it) => {
    switch (it.kind) {
      case 'MIN_QTY':
        return agg.qty >= it.value;
      case 'MIN_AMOUNT':
        return agg.amount >= it.value;
      case 'MIN_LINES':
        return agg.lineCount >= it.value;
      default:
        return false;
    }
  });

  return cond.logic === 'OR' ? checks.some(Boolean) : checks.every(Boolean);
}

function rewardOnAmount(type: DiscountRewardType, value: number, amount: number): number {
  if (amount <= 0) return 0;
  if (type === DiscountRewardType.PERCENT) {
    return Math.min(amount, Math.floor((amount * value) / 100));
  }
  return Math.min(amount, value);
}

/** Пропорционально line totals; остаток — на строку с max total (стабильно по key). */
export function allocateDiscount(
  lines: PricingLineIn[],
  discountTotal: number,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const l of lines) out.set(l.key, 0);
  if (discountTotal <= 0 || !lines.length) return out;

  const totals = lines.map((l) => ({ key: l.key, total: lineTotal(l) }));
  const scopeSum = totals.reduce((s, t) => s + t.total, 0);
  if (scopeSum <= 0) return out;

  const capped = Math.min(discountTotal, scopeSum);
  let allocated = 0;
  const sorted = [...totals].sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i]!;
    let share: number;
    if (i === sorted.length - 1) {
      share = capped - allocated;
    } else {
      share = Math.floor((capped * row.total) / scopeSum);
      allocated += share;
    }
    out.set(row.key, Math.max(0, share));
  }
  return out;
}

type ChosenRule = {
  ruleId: string;
  rewardType: DiscountRewardType;
  rewardValue: number;
  rewardAmount: number;
};

function pickRule(campaign: CampaignIn, scoped: PricingLineIn[]): ChosenRule | null {
  const agg = scopeAgg(scoped);
  let best: ChosenRule | null = null;
  const sorted = [...campaign.rules].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
  );
  // Макс. выгода; при равенстве — меньший sortOrder (порядок sorted).
  for (const rule of sorted) {
    if (!conditionsPass(rule.conditions, agg)) continue;
    const amount = rewardOnAmount(rule.rewardType, rule.rewardValue, agg.amount);
    if (amount <= 0) continue;
    if (!best || amount > best.rewardAmount) {
      best = {
        ruleId: rule.id,
        rewardType: rule.rewardType,
        rewardValue: rule.rewardValue,
        rewardAmount: amount,
      };
    }
  }
  return best;
}

/**
 * Каталожные кампании: на позицию — одна с макс. выгодой (не стакаются между собой).
 * Промокод применяется отдельно к subtotal после кампаний (см. STRUCTURE).
 */
export function priceCartLines(
  linesIn: PricingLineIn[],
  campaigns: CampaignIn[],
): CartPricingResult {
  const lines = linesIn.map((l) => ({
    ...l,
    listPrice: Math.max(0, Math.floor(l.listPrice)),
    qty: Math.max(0, Math.floor(l.qty)),
  }));

  type Cand = {
    discountId: string;
    discountName: string;
    startsAt: number;
    lineDiscount: number;
  };

  const candidatesByLine = new Map<string, Cand[]>();
  for (const l of lines) candidatesByLine.set(l.key, []);

  for (const campaign of campaigns) {
    const scoped = lines.filter((l) => inScope(campaign, l));
    if (!scoped.length) continue;
    const rule = pickRule(campaign, scoped);
    if (!rule) continue;
    const alloc = allocateDiscount(scoped, rule.rewardAmount);
    for (const l of scoped) {
      const lineDiscount = alloc.get(l.key) ?? 0;
      if (lineDiscount <= 0) continue;
      candidatesByLine.get(l.key)!.push({
        discountId: campaign.id,
        discountName: campaign.name,
        startsAt: campaign.startsAt.getTime(),
        lineDiscount,
      });
    }
  }

  // Выбор кампании на строку: max benefit → earlier startsAt → smaller id
  const winnerIdByLine = new Map<string, string | null>();
  for (const l of lines) {
    const cands = candidatesByLine.get(l.key) ?? [];
    if (!cands.length) {
      winnerIdByLine.set(l.key, null);
      continue;
    }
    cands.sort(
      (a, b) =>
        b.lineDiscount - a.lineDiscount ||
        a.startsAt - b.startsAt ||
        a.discountId.localeCompare(b.discountId),
    );
    winnerIdByLine.set(l.key, cands[0]!.discountId);
  }

  // Пересчёт FIXED/PERCENT только по строкам, выбравшим кампанию
  const finalDiscount = new Map<string, { id: string; name: string; amount: number }>();
  const byCampaign = new Map<string, PricingLineIn[]>();
  for (const l of lines) {
    const id = winnerIdByLine.get(l.key);
    if (!id) continue;
    const arr = byCampaign.get(id) ?? [];
    arr.push(l);
    byCampaign.set(id, arr);
  }

  for (const [discountId, group] of byCampaign) {
    const campaign = campaigns.find((c) => c.id === discountId);
    if (!campaign) continue;
    // Условия уже проходили на полном scope; reward — на выбранной группе
    const agg = scopeAgg(group);
    const sorted = [...campaign.rules].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
    );
    let best: ChosenRule | null = null;
    for (const rule of sorted) {
      // conditions: re-check against original full scope for unlock, reward on group
      const fullScoped = lines.filter((l) => inScope(campaign, l));
      if (!conditionsPass(rule.conditions, scopeAgg(fullScoped))) continue;
      const amount = rewardOnAmount(rule.rewardType, rule.rewardValue, agg.amount);
      if (amount <= 0) continue;
      if (!best || amount > best.rewardAmount) {
        best = {
          ruleId: rule.id,
          rewardType: rule.rewardType,
          rewardValue: rule.rewardValue,
          rewardAmount: amount,
        };
      }
    }
    if (!best) continue;
    const alloc = allocateDiscount(group, best.rewardAmount);
    for (const l of group) {
      finalDiscount.set(l.key, {
        id: campaign.id,
        name: campaign.name,
        amount: alloc.get(l.key) ?? 0,
      });
    }
  }

  const out: PricingLineOut[] = lines.map((l) => {
    const d = finalDiscount.get(l.key);
    const lineDiscount = d?.amount ?? 0;
    const total = lineTotal(l);
    const after = Math.max(0, total - lineDiscount);
    const price = l.qty > 0 ? Math.floor(after / l.qty) : l.listPrice;
    // корректировка остатка от floor(unit): держим lineDiscount согласованным
    const effectiveLineTotal = price * l.qty;
    const adjustedDiscount = Math.max(0, total - effectiveLineTotal);
    return {
      ...l,
      price,
      lineDiscount: adjustedDiscount,
      discountId: d?.id ?? null,
      discountName: d?.name ?? null,
    };
  });

  const listSubtotal = out.reduce((s, l) => s + l.listPrice * l.qty, 0);
  const subtotal = out.reduce((s, l) => s + l.price * l.qty, 0);
  return {
    lines: out,
    listSubtotal,
    subtotal,
    campaignDiscountTotal: Math.max(0, listSubtotal - subtotal),
  };
}
