import { buyerNestFetch, nestJsonResponse } from '@/lib/buyerNestFetch';

export const dynamic = 'force-dynamic';

export async function GET() {
  const res = await buyerNestFetch('/account/orders');
  return nestJsonResponse(res);
}
