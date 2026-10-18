import { NextResponse } from 'next/server';
import { setBuyerCookieIfUser } from '@/lib/buyerAuthBff';
import { readNestError } from '@/lib/nestBff';
import { firstPasswordError } from '@/lib/passwordPolicy';
import { getServerApiBase } from '@/lib/serverApiBase';

/** POST /api/auth/register/complete → Nest register/complete + buyer cookie. */
export async function POST(request: Request) {
  let body: {
    completionToken?: string;
    password?: string;
    guestId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const completionToken =
    typeof body.completionToken === 'string' ? body.completionToken.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const guestId =
    typeof body.guestId === 'string' ? body.guestId.trim() || undefined : undefined;

  if (!completionToken) {
    return NextResponse.json(
      { error: 'Нет токена подтверждения' },
      { status: 400 },
    );
  }
  const passwordError = firstPasswordError(password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`${getServerApiBase()}/auth/register/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        completionToken,
        password,
        guestId,
      }),
    });
  } catch {
    return NextResponse.json({ error: 'Нет связи с API' }, { status: 502 });
  }

  if (!res.ok) {
    const nestMsg = await readNestError(res);
    return NextResponse.json(
      { error: nestMsg ?? 'Не удалось зарегистрироваться' },
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
    return NextResponse.json({ error: 'Не удалось создать сессию' }, { status: 502 });
  }
  return response;
}
