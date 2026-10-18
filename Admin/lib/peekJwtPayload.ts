/**
 * Декодирует payload JWT без проверки подписи (Edge middleware).
 * Подпись / tokenVersion проверяет Nest; здесь — отсечь USER cookie и протухший exp.
 */
export function peekJwtPayload(
  token: string,
): { role?: string; exp?: number } | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const json = atob(b64 + pad);
    const data = JSON.parse(json) as { role?: unknown; exp?: unknown };
    return {
      role: typeof data.role === 'string' ? data.role : undefined,
      exp: typeof data.exp === 'number' ? data.exp : undefined,
    };
  } catch {
    return null;
  }
}
