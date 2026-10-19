import { NextRequest, NextResponse } from 'next/server';

/** localhost ↔ 127.0.0.1 — часто ломает Origin CSRF при локальной админке. */
function expandLocalDevOrigins(url: string, into: Set<string>) {
  into.add(url);
  try {
    const u = new URL(url);
    if (u.hostname === 'localhost') {
      u.hostname = '127.0.0.1';
      into.add(u.origin);
    } else if (u.hostname === '127.0.0.1') {
      u.hostname = 'localhost';
      into.add(u.origin);
    }
  } catch {
    /* ignore */
  }
}

/** CSRF: мутирующие запросы к BFF только с нашего Origin (cookie + SameSite=Lax недостаточно). */
export function rejectForeignOriginMutations(request: NextRequest): NextResponse | null {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return null;

  const origin = request.headers.get('origin')?.trim();
  if (!origin) {
    const site = request.headers.get('sec-fetch-site');
    if (site === 'same-origin' || site === 'none') return null;
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '')
    .split(',')[0]
    ?.trim();
  if (!host) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const allowed = new Set<string>();
  expandLocalDevOrigins(`https://${host}`, allowed);
  expandLocalDevOrigins(`http://${host}`, allowed);
  const extra = process.env.ADMIN_APP_ORIGIN?.trim();
  if (extra) expandLocalDevOrigins(extra.replace(/\/$/, ''), allowed);

  if (!allowed.has(origin)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }
  return null;
}
