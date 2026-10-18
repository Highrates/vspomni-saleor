import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

type VariantStockRow = {
  id: string;
  stock: number;
  stockReserve: number;
};

/** Блокирует варианты и увеличивает stockReserve (create / AWAITING). */
export async function reserveStockForLines(
  tx: Tx,
  lines: Array<{ variantId: string | null | undefined; qty: number; title?: string }>,
): Promise<void> {
  for (const line of lines) {
    const variantId = line.variantId?.trim();
    if (!variantId || line.qty <= 0) continue;

    const rows = await tx.$queryRaw<VariantStockRow[]>`
      SELECT id, stock, "stockReserve"
      FROM "ProductVariant"
      WHERE id = ${variantId}
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
    await tx.productVariant.update({
      where: { id: variantId },
      data: { stockReserve: { increment: line.qty } },
    });
  }
}

/** Снимает резерв без списания stock (cancel AWAITING / abandon). */
export async function releaseStockReserve(
  tx: Tx,
  lines: Array<{ variantId: string | null | undefined; qty: number }>,
): Promise<void> {
  for (const line of lines) {
    const variantId = line.variantId?.trim();
    if (!variantId || line.qty <= 0) continue;
    await tx.$executeRaw`
      UPDATE "ProductVariant"
      SET "stockReserve" = GREATEST(0, "stockReserve" - ${line.qty})
      WHERE id = ${variantId}
    `;
  }
}

/**
 * Оплата: stock −= qty, stockReserve −= qty (резерв → продажа).
 */
export async function commitStockOnPaid(
  tx: Tx,
  lines: Array<{ variantId: string | null | undefined; qty: number }>,
): Promise<void> {
  for (const line of lines) {
    const variantId = line.variantId?.trim();
    if (!variantId || line.qty <= 0) continue;
    await tx.$queryRaw`
      SELECT id FROM "ProductVariant" WHERE id = ${variantId} FOR UPDATE
    `;
    await tx.$executeRaw`
      UPDATE "ProductVariant"
      SET
        stock = GREATEST(0, stock - ${line.qty}),
        "stockReserve" = GREATEST(0, "stockReserve" - ${line.qty})
      WHERE id = ${variantId}
    `;
  }
}

/** Отмена уже оплаченного: вернуть qty на stock. */
export async function restoreStockOnPaidCancel(
  tx: Tx,
  lines: Array<{ variantId: string | null | undefined; qty: number }>,
): Promise<void> {
  for (const line of lines) {
    const variantId = line.variantId?.trim();
    if (!variantId || line.qty <= 0) continue;
    await tx.productVariant.update({
      where: { id: variantId },
      data: { stock: { increment: line.qty } },
    });
  }
}
