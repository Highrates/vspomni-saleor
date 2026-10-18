import { NextResponse } from 'next/server';
import { buyerNestFetch, nestJsonResponse } from '@/lib/buyerNestFetch';

export const dynamic = 'force-dynamic';

export async function GET() {
  const res = await buyerNestFetch('/account/me');
  return nestJsonResponse(res);
}

export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const res = await buyerNestFetch('/account/me', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return nestJsonResponse(res);
}
