import { BadRequestException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import {
  isPaidEditableStatus,
  isUnpaidEditableStatus,
} from './order-admin-edit';
import {
  releaseStockReserve,
  reserveStockForLines,
  restoreStockOnPaidCancel,
} from './order-stock';

type Tx = Prisma.TransactionClient;

export type OrderItemStockLine = {
  variantId: string | null;
  qty: number;
  title?: string;
};

function qtyMap(lines: OrderItemStockLine[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of lines) {
    const id = l.variantId?.trim();
    if (!id || l.qty <= 0) continue;
    m.set(id, (m.get(id) ?? 0) + l.qty);
  }
  return m;
}

/** Синхронизирует stock/reserve при изменении состава заказа в админке. */
export async function adjustStockForItemEdit(
  tx: Tx,
  status: OrderStatus,
  oldLines: OrderItemStockLine[],
  newLines: OrderItemStockLine[],
): Promise<void> {
  const oldMap = qtyMap(oldLines);
  const newMap = qtyMap(newLines);
  const ids = new Set([...oldMap.keys(), ...newMap.keys()]);

  const increases: Array<{ variantId: string; qty: number; title?: string }> = [];
  const decreases: Array<{ variantId: string; qty: number }> = [];

  for (const id of ids) {
    const delta = (newMap.get(id) ?? 0) - (oldMap.get(id) ?? 0);
    if (delta > 0) {
      const title = newLines.find((l) => l.variantId === id)?.title;
      increases.push({ variantId: id, qty: delta, title });
    } else if (delta < 0) {
      decreases.push({ variantId: id, qty: -delta });
    }
  }

  if (isUnpaidEditableStatus(status)) {
    if (decreases.length) await releaseStockReserve(tx, decreases);
    if (increases.length) await reserveStockForLines(tx, increases);
    return;
  }

  if (isPaidEditableStatus(status)) {
    if (decreases.length) await restoreStockOnPaidCancel(tx, decreases);
    for (const line of increases) {
      const rows = await tx.$queryRaw<
        Array<{ id: string; stock: number; stockReserve: number }>
      >`
        SELECT id, stock, "stockReserve"
        FROM "ProductVariant"
        WHERE id = ${line.variantId}
        FOR UPDATE
      `;
      const v = rows[0];
      if (!v) {
        throw new BadRequestException(
          `Вариант недоступен${line.title ? `: ${line.title}` : ''}`,
        );
      }
      const available = Math.max(0, v.stock - v.stockReserve);
      if (available < line.qty) {
        throw new BadRequestException(
          `Недостаточно наличия${line.title ? ` («${line.title}»)` : ''}: доступно ${available}, нужно ${line.qty}`,
        );
      }
      await tx.$executeRaw`
        UPDATE "ProductVariant"
        SET stock = GREATEST(0, stock - ${line.qty})
        WHERE id = ${line.variantId}
      `;
    }
  }
}
