import { NextResponse } from 'next/server';
import { buyerNestFetch, nestJsonResponse } from '@/lib/buyerNestFetch';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

export async function POST(_request: Request, { params }: Ctx) {
  const id = params.id?.trim();
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }
  const res = await buyerNestFetch(
    `/account/orders/${encodeURIComponent(id)}/cancel`,
    { method: 'POST' },
  );
  return nestJsonResponse(res);
}
