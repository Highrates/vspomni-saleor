import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { OrderStatus } from '@prisma/client';
import { adjustStockForItemEdit } from './order-item-stock-edit';
import { commitStockOnPaid, reserveStockForLines } from './order-stock';
import { createStatefulStockTx } from './order-stock.test-helpers';

describe('adjustStockForItemEdit', () => {
  beforeEach(() => {});

  describe('неоплаченный заказ (NEW / AWAITING_PAYMENT)', () => {
    it('увеличение qty резервирует дельту', async () => {
      const stateful = createStatefulStockTx({
        v1: { stock: 10, stockReserve: 2 },
      });

      await adjustStockForItemEdit(
        stateful as never,
        OrderStatus.AWAITING_PAYMENT,
        [{ variantId: 'v1', qty: 2 }],
        [{ variantId: 'v1', qty: 5 }],
      );

      expect(stateful.getVariant('v1')).toEqual({ stock: 10, stockReserve: 5 });
      expect(stateful.getAvailable('v1')).toBe(5);
    });

    it('уменьшение qty снимает reserve', async () => {
      const stateful = createStatefulStockTx({
        v1: { stock: 10, stockReserve: 5 },
      });

      await adjustStockForItemEdit(
        stateful as never,
        OrderStatus.NEW,
        [{ variantId: 'v1', qty: 5 }],
        [{ variantId: 'v1', qty: 2 }],
      );

      expect(stateful.getVariant('v1')).toEqual({ stock: 10, stockReserve: 2 });
    });

    it('недостаточно available при увеличении → BadRequest', async () => {
      const stateful = createStatefulStockTx({
        v1: { stock: 5, stockReserve: 4 },
      });

      await expect(
        adjustStockForItemEdit(
          stateful as never,
          OrderStatus.AWAITING_PAYMENT,
          [{ variantId: 'v1', qty: 1 }],
          [{ variantId: 'v1', qty: 3, title: 'Сыворотка' }],
        ),
      ).rejects.toMatchObject({
        message: expect.stringMatching(/Недостаточно наличия.*«Сыворотка»/),
      });
    });
  });

  describe('оплаченный заказ (PAID / PACKING)', () => {
    it('уменьшение qty возвращает stock', async () => {
      const stateful = createStatefulStockTx({
        v1: { stock: 7, stockReserve: 0 },
      });

      await adjustStockForItemEdit(
        stateful as never,
        OrderStatus.PAID,
        [{ variantId: 'v1', qty: 5 }],
        [{ variantId: 'v1', qty: 2 }],
      );

      expect(stateful.getVariant('v1')).toEqual({ stock: 10, stockReserve: 0 });
    });

    it('увеличение qty списывает stock напрямую', async () => {
      const stateful = createStatefulStockTx({
        v1: { stock: 10, stockReserve: 0 },
      });
      await reserveStockForLines(stateful as never, [{ variantId: 'v1', qty: 3 }]);
      await commitStockOnPaid(stateful as never, [{ variantId: 'v1', qty: 3 }]);
      expect(stateful.getVariant('v1')).toEqual({ stock: 7, stockReserve: 0 });

      await adjustStockForItemEdit(
        stateful as never,
        OrderStatus.PACKING,
        [{ variantId: 'v1', qty: 3 }],
        [{ variantId: 'v1', qty: 5 }],
      );

      expect(stateful.getVariant('v1')).toEqual({ stock: 5, stockReserve: 0 });
      expect(stateful.getAvailable('v1')).toBe(5);
    });

    it('недостаточно available при увеличении на PAID → BadRequest', async () => {
      const stateful = createStatefulStockTx({
        v1: { stock: 3, stockReserve: 1 },
      });

      await expect(
        adjustStockForItemEdit(
          stateful as never,
          OrderStatus.PAID,
          [{ variantId: 'v1', qty: 1 }],
          [{ variantId: 'v1', qty: 4 }],
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(stateful.getVariant('v1')?.stock).toBe(3);
    });
  });

  it('без изменений qty — stock не трогается', async () => {
    const stateful = createStatefulStockTx({
      v1: { stock: 10, stockReserve: 3 },
    });

    await adjustStockForItemEdit(
      stateful as never,
      OrderStatus.AWAITING_PAYMENT,
      [{ variantId: 'v1', qty: 3 }],
      [{ variantId: 'v1', qty: 3 }],
    );

    expect(stateful.getVariant('v1')).toEqual({ stock: 10, stockReserve: 3 });
    expect(stateful.$queryRaw).not.toHaveBeenCalled();
    expect(stateful.$executeRaw).not.toHaveBeenCalled();
    expect(stateful.productVariant.update).not.toHaveBeenCalled();
  });
});
