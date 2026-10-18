import { NextResponse } from 'next/server';
import { buyerNestFetch, nestJsonResponse } from '@/lib/buyerNestFetch';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

export async function PATCH(request: Request, { params }: Ctx) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const res = await buyerNestFetch(
    `/account/addresses/${encodeURIComponent(params.id)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  );
  return nestJsonResponse(res);
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const res = await buyerNestFetch(
    `/account/addresses/${encodeURIComponent(params.id)}`,
    { method: 'DELETE' },
  );
  return nestJsonResponse(res);
}
