import { describe, expect, it } from 'vitest';
import { OrderStatus } from '@prisma/client';
import {
  canCancel,
  canDeliver,
  canMarkPaid,
  canRefund,
  canShip,
  canStartPacking,
  canTransition,
  remainingRefundable,
} from './order-transitions';

describe('order-transitions', () => {
  it('PAID → PACKING → SHIPPED → DELIVERED', () => {
    expect(canTransition(OrderStatus.PAID, OrderStatus.PACKING)).toBe(true);
    expect(canStartPacking(OrderStatus.PAID)).toBe(true);
    expect(canShip(OrderStatus.PACKING)).toBe(true);
    expect(canDeliver(OrderStatus.SHIPPED)).toBe(true);
    expect(canTransition(OrderStatus.PAID, OrderStatus.SHIPPED)).toBe(false);
  });

  it('cancel / mark-paid / refund guards', () => {
    expect(canCancel(OrderStatus.AWAITING_PAYMENT)).toBe(true);
    expect(canCancel(OrderStatus.PAID)).toBe(false);
    expect(canCancel(OrderStatus.PACKING)).toBe(false);
    expect(canCancel(OrderStatus.SHIPPED)).toBe(false);
    expect(canMarkPaid(OrderStatus.AWAITING_PAYMENT)).toBe(true);
    expect(canMarkPaid(OrderStatus.PAID)).toBe(false);
    expect(canRefund(OrderStatus.DELIVERED)).toBe(true);
    expect(canRefund(OrderStatus.CANCELLED)).toBe(false);
  });

  it('remainingRefundable', () => {
    expect(remainingRefundable(1000, 0)).toBe(1000);
    expect(remainingRefundable(1000, 400)).toBe(600);
    expect(remainingRefundable(1000, 1000)).toBe(0);
  });
});
