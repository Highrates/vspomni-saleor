/** Сброс ISR FAQ / главной /faq после правок в админке. */
export async function revalidateFaqStorefront(): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/revalidate-faq', {
      method: 'POST',
      credentials: 'same-origin',
    });
    return res.ok;
  } catch {
    return false;
  }
}
