import type { Prisma } from '@prisma/client';

/** Блокирует строку Order до конца транзакции (pay / refund / cancel / markPaid). */
export async function lockOrderForUpdate(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  await tx.$queryRaw`
    SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE
  `;
}

/** Рубли из ответа ЮKassa (`"500.00"` → 500). */
export function parseYooKassaAmountRub(
  amount: { value?: string } | null | undefined,
): number | null {
  if (!amount?.value) return null;
  const n = Math.round(Number.parseFloat(amount.value));
  return Number.isFinite(n) ? n : null;
}
