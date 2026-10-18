import { NextResponse } from 'next/server';
import { CART_SETTINGS_DEFAULTS } from '@/lib/cartSettings';
import { getServerApiBase } from '@/lib/serverApiBase';

export const dynamic = 'force-dynamic';

/** @deprecated use /api/public/cart */
export async function GET() {
  const url = `${getServerApiBase()}/settings/cart`;
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') ?? 'application/json; charset=utf-8',
      },
    });
  } catch {
    return NextResponse.json(CART_SETTINGS_DEFAULTS, { status: 200 });
  }
}
