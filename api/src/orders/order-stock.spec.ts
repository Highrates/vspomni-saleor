import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  releaseStockReserve,
  commitStockOnPaid,
  restoreStockOnPaidCancel,
} from './order-stock';

describe('order-stock', () => {
  const tx = {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    productVariant: { update: vi.fn() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('releaseStockReserve пишет GREATEST update', async () => {
    await releaseStockReserve(tx as never, [{ variantId: 'v1', qty: 2 }]);
    expect(tx.$executeRaw).toHaveBeenCalled();
  });

  it('commitStockOnPaid: FOR UPDATE + stock/reserve', async () => {
    tx.$queryRaw.mockResolvedValue([{ id: 'v1' }]);
    await commitStockOnPaid(tx as never, [{ variantId: 'v1', qty: 1 }]);
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.$executeRaw).toHaveBeenCalled();
  });

  it('restoreStockOnPaidCancel возвращает stock', async () => {
    await restoreStockOnPaidCancel(tx as never, [{ variantId: 'v1', qty: 3 }]);
    expect(tx.productVariant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'v1' },
        data: { stock: { increment: 3 } },
      }),
    );
  });

  it('пропускает пустые lines', async () => {
    await releaseStockReserve(tx as never, [
      { variantId: '', qty: 1 },
      { variantId: 'v1', qty: 0 },
    ]);
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });
});
