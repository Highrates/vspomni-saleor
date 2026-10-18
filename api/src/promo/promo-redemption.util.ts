import { OrderStatus, Prisma } from '@prisma/client';

/**
 * Слоты, которые держат лимит промокода:
 * — AWAITING_PAYMENT / NEW: hold при создании заказа (анти-race до оплаты)
 * — PAID+: фактическое сжигание
 * CANCELLED не входит — hold снимается (или redemption orphan не учитывается).
 */
export const PROMO_HOLDING_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.AWAITING_PAYMENT,
  OrderStatus.NEW,
  OrderStatus.PAID,
  OrderStatus.PACKING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

/** @deprecated alias — то же, что holding (лимиты считают и unpaid hold). */
export const PROMO_CONSUMING_ORDER_STATUSES = PROMO_HOLDING_ORDER_STATUSES;

export const promoConsumingRedemptionWhere: Prisma.PromoCodeRedemptionWhereInput = {
  order: { status: { in: PROMO_HOLDING_ORDER_STATUSES } },
};
