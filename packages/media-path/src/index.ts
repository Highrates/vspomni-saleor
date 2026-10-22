/**
 * Absolute Nest/CDN URL → relative `/uploads…` / `/images…` / `/logo…`.
 * Общий helper для API serialize и Admin preview (не подменяет uploadsOrigin витрины).
 */
export function toRelativeMediaPath(url: string | null | undefined): string {
  const s = (url || '').trim()
  if (!s) return ''
  if (s.startsWith('/') && !s.startsWith('//')) return s
  try {
    const u = new URL(s)
    if (
      u.pathname.startsWith('/uploads') ||
      u.pathname.startsWith('/images/') ||
      u.pathname.startsWith('/logo/')
    ) {
      return `${u.pathname}${u.search}`
    }
  } catch {
    /* ignore */
  }
  return s
}
