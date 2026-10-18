import { buyerNestFetch, nestJsonResponse } from '@/lib/buyerNestFetch';

export async function GET() {
  const res = await buyerNestFetch('/account/favorites');
  return nestJsonResponse(res);
}

export async function PUT(request: Request) {
  const body = await request.text();
  const res = await buyerNestFetch('/account/favorites', {
    method: 'PUT',
    body,
  });
  return nestJsonResponse(res);
}

export async function DELETE() {
  const res = await buyerNestFetch('/account/favorites', { method: 'DELETE' });
  return nestJsonResponse(res);
}
