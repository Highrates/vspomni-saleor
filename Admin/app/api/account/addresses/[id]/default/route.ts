import { buyerNestFetch, nestJsonResponse } from '@/lib/buyerNestFetch';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

export async function POST(_request: Request, { params }: Ctx) {
  const res = await buyerNestFetch(
    `/account/addresses/${encodeURIComponent(params.id)}/default`,
    { method: 'POST' },
  );
  return nestJsonResponse(res);
}
