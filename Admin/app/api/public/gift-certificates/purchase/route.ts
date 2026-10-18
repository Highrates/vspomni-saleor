import { NextRequest, NextResponse } from 'next/server';
import { getServerApiBase } from '@/lib/serverApiBase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const base = getServerApiBase();
  try {
    const body = await request.text();
    const cookie = request.headers.get('cookie') ?? '';
    const res = await fetch(`${base}/gift-certificates/purchase`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body,
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') ?? 'application/json; charset=utf-8',
      },
    });
  } catch {
    return NextResponse.json({ message: 'Сервис недоступен' }, { status: 502 });
  }
}
