/** Fire-and-forget сброс ISR витрины каталога после админ-правок. */
export async function revalidateCatalogStorefront(opts?: {
  productSlug?: string;
  cat?: string;
  sub?: string;
}): Promise<void> {
  try {
    await fetch('/api/admin/revalidate-catalog', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productSlug: opts?.productSlug,
        cat: opts?.cat,
        sub: opts?.sub,
      }),
    });
  } catch {
    /* cache lag ok */
  }
}
