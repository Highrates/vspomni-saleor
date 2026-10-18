/** Shared cart settings (admin + public fallbacks). Align with backend CART_DEFAULTS / DTO Max. */

export type CartSettings = {
  freeShippingThresholdRub: number;
  progressContentText: string;
  progressSuccessText: string;
  legalHtml: string;
};

export const CART_THRESHOLD_MAX_RUB = 10_000_000;

export const CART_SETTINGS_DEFAULTS: CartSettings = {
  freeShippingThresholdRub: 10000,
  progressContentText: 'до бесплатной доставки до ПВЗ',
  progressSuccessText: 'Бесплатная доставка до ПВЗ!',
  legalHtml: '<p></p>',
};

export function normalizeCartSettings(
  data: Partial<CartSettings> | null | undefined,
): CartSettings {
  const d = data ?? {};
  return {
    freeShippingThresholdRub:
      typeof d.freeShippingThresholdRub === 'number' &&
      Number.isFinite(d.freeShippingThresholdRub)
        ? d.freeShippingThresholdRub
        : CART_SETTINGS_DEFAULTS.freeShippingThresholdRub,
    progressContentText:
      d.progressContentText?.trim() || CART_SETTINGS_DEFAULTS.progressContentText,
    progressSuccessText:
      d.progressSuccessText?.trim() || CART_SETTINGS_DEFAULTS.progressSuccessText,
    legalHtml: d.legalHtml?.trim() || CART_SETTINGS_DEFAULTS.legalHtml,
  };
}
