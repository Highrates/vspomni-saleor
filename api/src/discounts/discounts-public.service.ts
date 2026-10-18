import { Injectable } from '@nestjs/common';
import { DiscountRewardType, DiscountScope, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  type CampaignIn,
  type CartPricingResult,
  type PricingLineIn,
  priceCartLines,
} from './discount-pricing.engine';

const runningWhere = (now: Date): Prisma.DiscountWhereInput => ({
  active: true,
  startsAt: { lte: now },
  AND: [
    { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
    { rules: { some: {} } },
  ],
});

@Injectable()
export class DiscountsPublicService {
  constructor(private readonly prisma: PrismaService) {}

  async loadRunningCampaigns(now: Date = new Date()): Promise<CampaignIn[]> {
    const rows = await this.prisma.discount.findMany({
      where: runningWhere(now),
      include: {
        categories: { select: { categoryId: true } },
        products: { select: { productId: true } },
        rules: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            sortOrder: true,
            conditions: true,
            rewardType: true,
            rewardValue: true,
          },
        },
      },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    });

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      startsAt: r.startsAt,
      scope: r.scope as DiscountScope,
      categoryIds: r.categories.map((c) => c.categoryId),
      productIds: r.products.map((p) => p.productId),
      rules: r.rules.map((rule) => ({
        id: rule.id,
        sortOrder: rule.sortOrder,
        conditions: rule.conditions,
        rewardType: rule.rewardType as DiscountRewardType,
        rewardValue: rule.rewardValue,
      })),
    }));
  }

  async priceLines(lines: PricingLineIn[], now: Date = new Date()): Promise<CartPricingResult> {
    if (!lines.length) {
      return { lines: [], listSubtotal: 0, subtotal: 0, campaignDiscountTotal: 0 };
    }
    const campaigns = await this.loadRunningCampaigns(now);
    return priceCartLines(lines, campaigns);
  }
}
