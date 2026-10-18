import { buyerNestFetch, nestJsonResponse } from '@/lib/buyerNestFetch';

export async function GET() {
  const res = await buyerNestFetch('/account/favorites/items');
  return nestJsonResponse(res);
}
