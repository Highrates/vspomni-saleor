import { vi } from 'vitest';

export type VariantState = { stock: number; stockReserve: number };

export function available(v: VariantState): number {
  return Math.max(0, v.stock - v.stockReserve);
}

/** In-memory tx: эмулирует stock/stockReserve через те же SQL-пути, что и production. */
export function createStatefulStockTx(initial: Record<string, VariantState>) {
  const variants: Record<string, VariantState> = structuredClone(initial);

  const tx = {
    $queryRaw: vi.fn(async (...args: unknown[]) => {
      const values = args.slice(1) as string[];
      const variantId = values[values.length - 1];
      const v = variants[variantId];
      if (!v) return [];
      const sql = String(args[0]);
      if (sql.includes('"stockReserve"')) {
        return [{ id: variantId, stock: v.stock, stockReserve: v.stockReserve }];
      }
      return [{ id: variantId }];
    }),
    $executeRaw: vi.fn(async (...args: unknown[]) => {
      const values = args.slice(1) as (string | number)[];
      const variantId = values[values.length - 1] as string;
      const qty = values[0] as number;
      const v = variants[variantId];
      if (!v) return;
      const sql = String(args[0]);
      if (
        sql.includes('stock = GREATEST') &&
        sql.includes('"stockReserve" = GREATEST')
      ) {
        v.stock = Math.max(0, v.stock - qty);
        v.stockReserve = Math.max(0, v.stockReserve - qty);
      } else if (sql.includes('"stockReserve" = GREATEST')) {
        v.stockReserve = Math.max(0, v.stockReserve - qty);
      } else if (sql.includes('stock = GREATEST')) {
        v.stock = Math.max(0, v.stock - qty);
      } else if (sql.includes('stockReserve')) {
        v.stockReserve = Math.max(0, v.stockReserve - qty);
      }
    }),
    productVariant: {
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: {
            stockReserve?: { increment: number };
            stock?: { increment: number };
          };
        }) => {
          const v = variants[where.id];
          if (!v) throw new Error(`variant ${where.id} missing`);
          if (data.stockReserve?.increment != null) {
            v.stockReserve += data.stockReserve.increment;
          }
          if (data.stock?.increment != null) {
            v.stock += data.stock.increment;
          }
        },
      ),
    },
    getVariant: (id: string) => variants[id],
    getAvailable: (id: string) => (variants[id] ? available(variants[id]) : 0),
  };

  return tx;
}
