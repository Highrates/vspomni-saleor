import { buyerNestFetch, nestJsonResponse } from '@/lib/buyerNestFetch';

type Ctx = { params: { variantId: string } };

export async function POST(_request: Request, { params }: Ctx) {
  const res = await buyerNestFetch(
    `/account/favorites/${encodeURIComponent(params.variantId)}`,
    { method: 'POST' },
  );
  return nestJsonResponse(res);
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const res = await buyerNestFetch(
    `/account/favorites/${encodeURIComponent(params.variantId)}`,
    { method: 'DELETE' },
  );
  return nestJsonResponse(res);
}
