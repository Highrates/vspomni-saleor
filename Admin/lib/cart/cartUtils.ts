/** Shared cart helpers safe for Server Components. */

export function cartLineKey(variantId: string, shadeId?: string | null): string {
  return `${variantId}:${shadeId ?? ''}`;
}

/** PDP / drawer href with variant (+ optional shade). */
export function productCartHref(
  slug: string,
  variantId?: string | null,
  shadeId?: string | null,
): string {
  const qs = new URLSearchParams();
  if (variantId) qs.set('v', variantId);
  if (shadeId) qs.set('shade', shadeId);
  const q = qs.toString();
  return q ? `/product/${encodeURIComponent(slug)}?${q}` : `/product/${encodeURIComponent(slug)}`;
}
