'use client';

import { formatRub } from '@/lib/publicCatalog';
import styles from './CartOrderTotals.module.css';

export type CartOrderTotalsProps = {
  /** Каталожная скидка (list − price). */
  catalogDiscount: number;
  /** Скидка промокода или списание сертификата. */
  promoDiscount: number;
  promoCode?: string | null;
  promoKind?: 'promo' | 'gift' | null;
  /** Сумма «до скидок» для строки Сумма (listSubtotal или subtotal). */
  sumLabelAmount: number;
  /** Товары после промо (без доставки). */
  total: number;
  /**
   * Итог к оплате = goods + shipping (один источник с CTA / create).
   * Если задан — строка «Итого» берёт его, а не total+shipping.
   */
  payableTotal?: number | null;
  /** Оценка доставки (руб.); null — нет расчёта / ошибка. */
  shippingCost?: number | null;
  /** drawer: короче; checkout: доставка + финальный ряд. */
  variant: 'drawer' | 'checkout';
  className?: string;
};

/** Порядок: Сумма → Скидка(и) → Итого. */
export function CartOrderTotals({
  catalogDiscount,
  promoDiscount,
  promoCode,
  promoKind = 'promo',
  sumLabelAmount,
  total,
  payableTotal = null,
  shippingCost = null,
  variant,
  className,
}: CartOrderTotalsProps) {
  const showPromo = promoDiscount > 0;
  const showCatalog = catalogDiscount > 0;
  const showSum = showPromo || showCatalog;

  const shippingLabel =
    shippingCost == null
      ? 'Не удалось рассчитать'
      : shippingCost > 0
        ? formatRub(shippingCost)
        : 'Рассчитаем позже';

  const finalPayable =
    payableTotal != null
      ? payableTotal
      : shippingCost != null && shippingCost > 0
        ? total + shippingCost
        : total;

  const discountRows = (
    <>
      {showCatalog ? (
        <div className={styles.rowMuted}>
          <span>{variant === 'checkout' ? 'Скидка итого' : 'Скидка'}</span>
          <span>−{formatRub(catalogDiscount)}</span>
        </div>
      ) : null}
      {showPromo ? (
        <div className={styles.rowMuted}>
          <span>
            {promoKind === 'gift' ? 'Сертификат' : 'Промокод'}
            {promoCode ? ` (${promoCode})` : ''}
          </span>
          <span>−{formatRub(promoDiscount)}</span>
        </div>
      ) : null}
    </>
  );

  if (variant === 'drawer') {
    return (
      <div className={[styles.root, className].filter(Boolean).join(' ')}>
        {showSum ? (
          <div className={styles.row}>
            <span>Сумма</span>
            <span>{formatRub(sumLabelAmount)}</span>
          </div>
        ) : null}
        {discountRows}
        <div className={styles.row}>
          <span>Итого</span>
          <span>{formatRub(total)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <div className={styles.row}>
        <span>Сумма</span>
        <span>{formatRub(sumLabelAmount)}</span>
      </div>
      {discountRows}
      <div className={styles.rowNote}>
        <span>Доставка</span>
        <span>{shippingLabel}</span>
      </div>
      <div className={styles.rowFinal}>
        <span>Итого</span>
        <span>{formatRub(finalPayable)}</span>
      </div>
    </div>
  );
}
