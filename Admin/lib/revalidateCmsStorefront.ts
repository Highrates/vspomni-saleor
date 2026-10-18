/** Сброс ISR юр. страниц после правок в админке. */
export async function revalidateCmsStorefront(slug?: string): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/revalidate-cms', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slug ? { slug } : {}),
    });
    return res.ok;
  } catch {
    return false;
  }
}
