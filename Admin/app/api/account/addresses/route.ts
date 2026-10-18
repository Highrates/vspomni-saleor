import { NextResponse } from 'next/server';
import { buyerNestFetch, nestJsonResponse } from '@/lib/buyerNestFetch';

export const dynamic = 'force-dynamic';

export async function GET() {
  const res = await buyerNestFetch('/account/addresses');
  return nestJsonResponse(res);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const res = await buyerNestFetch('/account/addresses', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return nestJsonResponse(res);
}
