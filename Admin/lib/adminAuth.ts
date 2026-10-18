/** httpOnly cookie с JWT админки (не win-win имена). */
export const ADMIN_ACCESS_TOKEN_COOKIE = 'vspomni_admin_token';

/** Совпадает с Nest `JWT_EXPIRES_IN` (default 12h) — иначе cookie живёт дольше JWT → 401. */
export const ADMIN_TOKEN_MAX_AGE_SEC = 60 * 60 * 12;

export function adminCookieSecure(request: Request): boolean {
  const v = process.env.ADMIN_COOKIE_SECURE?.toLowerCase();
  if (v === '0' || v === 'false' || v === 'off') return false;
  if (v === '1' || v === 'true' || v === 'on') return true;
  const fwd = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  if (fwd === 'https') return true;
  if (fwd === 'http') return false;
  try {
    return new URL(request.url).protocol === 'https:';
  } catch {
    return false;
  }
}
