/**
 * Whitelist для `?from=` после login (buyer / admin).
 * Только relative path: `/…`, без `//`, `\`, схемы.
 */

function decodePath(raw: string): string | null {
  let path = raw.trim();
  try {
    path = decodeURIComponent(path);
  } catch {
    return null;
  }
  path = path.trim();
  if (!path.startsWith('/')) return null;
  if (path.startsWith('//') || path.includes('\\')) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path.slice(1))) return null;
  return path;
}

function pathnameOf(path: string): string {
  return path.split(/[?#]/, 1)[0] || '/';
}

function isDenied(pathname: string, deny: string[]): boolean {
  return deny.some(
    (d) => pathname === d || pathname.startsWith(d.endsWith('/') ? d : `${d}/`),
  );
}

/** Витрина / checkout: не auth, не admin. */
export function safeReturnPath(raw: string | null | undefined): string {
  const path = raw ? decodePath(raw) : null;
  if (!path) return '/';
  const pathname = pathnameOf(path);
  if (
    isDenied(pathname, ['/login', '/register', '/admin']) ||
    pathname === '/login' ||
    pathname === '/register'
  ) {
    return '/';
  }
  return path;
}

/** Админка: только `/admin…`, не login. */
export function safeAdminReturnPath(raw: string | null | undefined): string {
  const path = raw ? decodePath(raw) : null;
  if (!path) return '/admin';
  const pathname = pathnameOf(path);
  if (!pathname.startsWith('/admin')) return '/admin';
  if (pathname === '/admin/login' || pathname.startsWith('/admin/login/')) {
    return '/admin';
  }
  return path;
}

export function withReturnPath(path: string, from: string): string {
  if (!from || from === '/') return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}from=${encodeURIComponent(from)}`;
}

/** @deprecated используйте safeReturnPath */
export const safeAuthFrom = safeReturnPath;
/** @deprecated используйте withReturnPath */
export const withAuthFrom = withReturnPath;
