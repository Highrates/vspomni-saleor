/** Общие расчёты сумм корзины (drawer + checkout). */

export type CartTotalsLine = {
  price: number;
  listPrice?: number | null;
  qty: number;
};

export function computeLocalDiscount(
  type: string,
  value: number,
  subtotal: number,
): number {
  const base = Math.max(0, Math.floor(subtotal));
  if (base <= 0) return 0;
  if (type === 'PERCENT') return Math.min(base, Math.floor((base * value) / 100));
  if (type === 'FIXED') return Math.min(base, value);
  return 0;
}

export function computeSubtotal(items: CartTotalsLine[]): number {
  return items.reduce((sum, l) => sum + l.price * l.qty, 0);
}

/** Сумма по listPrice (или price, если list нет / ниже). */
export function computeListSubtotal(items: CartTotalsLine[]): number {
  return items.reduce((sum, l) => {
    const list =
      l.listPrice != null && l.listPrice > l.price ? l.listPrice : l.price;
    return sum + list * l.qty;
  }, 0);
}

/** Каталожная скидка: Σ (list − price) × qty. */
export function computeCatalogDiscount(items: CartTotalsLine[]): number {
  return items.reduce((sum, l) => {
    const list =
      l.listPrice != null && l.listPrice > l.price ? l.listPrice : l.price;
    return sum + Math.max(0, list - l.price) * l.qty;
  }, 0);
}

export function computePayableTotal(
  subtotal: number,
  promoDiscount: number,
  giftAmount = 0,
): number {
  return Math.max(0, subtotal - promoDiscount - giftAmount);
}
