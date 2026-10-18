import { NextResponse } from 'next/server';
import { setBuyerCookieIfUser } from '@/lib/buyerAuthBff';
import { readNestError } from '@/lib/nestBff';
import { getServerApiBase } from '@/lib/serverApiBase';

export async function POST(request: Request) {
  let body: { email?: string; password?: string; guestId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const guestId =
    typeof body.guestId === 'string' ? body.guestId.trim() || undefined : undefined;
  if (!email || password.length === 0) {
    return NextResponse.json({ error: 'Укажите email и пароль' }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`${getServerApiBase()}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, guestId }),
    });
  } catch {
    return NextResponse.json({ error: 'Нет связи с API' }, { status: 502 });
  }

  if (!res.ok) {
    const nestMsg = await readNestError(res);
    return NextResponse.json(
      { error: nestMsg ?? (res.status === 401 ? 'Неверный email или пароль' : 'Ошибка входа') },
      { status: res.status },
    );
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    return NextResponse.json({ error: 'Нет access_token' }, { status: 502 });
  }

  const response = NextResponse.json({ ok: true });
  const ok = await setBuyerCookieIfUser(request, response, data.access_token);
  if (!ok) {
    return NextResponse.json(
      { error: 'Этот аккаунт нельзя использовать для входа покупателя' },
      { status: 403 },
    );
  }
  return response;
}
