/**
 * Сообщение ошибки из Nest / BFF JSON (`message: string | string[]`).
 */
export function readApiError(
  data: { message?: string | string[]; error?: string } | null | undefined,
  fallback: string,
): string {
  if (!data) return fallback;
  if (typeof data.error === 'string' && data.error.trim()) return data.error.trim();
  if (Array.isArray(data.message)) {
    const first = data.message.find((m) => typeof m === 'string' && m.trim());
    return first || fallback;
  }
  if (typeof data.message === 'string' && data.message.trim()) {
    return data.message.trim();
  }
  return fallback;
}
