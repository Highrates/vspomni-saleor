import { NextResponse } from 'next/server';
import { readNestError } from '@/lib/nestBff';
import { getServerApiBase } from '@/lib/serverApiBase';

export async function POST(request: Request) {
  let body: { token?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const token = (body.token ?? '').trim();
  const password = typeof body.password === 'string' ? body.password : '';
  if (!token || password.length === 0) {
    return NextResponse.json(
      { error: 'Укажите токен и новый пароль' },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: 'Пароль не короче 8 символов' },
      { status: 400 },
    );
  }

  let res: Response;
  try {
    res = await fetch(`${getServerApiBase()}/auth/password-reset/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
  } catch {
    return NextResponse.json({ error: 'Нет связи с API' }, { status: 502 });
  }

  if (!res.ok) {
    const nestMsg = await readNestError(res);
    return NextResponse.json(
      { error: nestMsg ?? 'Не удалось сменить пароль' },
      { status: res.status },
    );
  }

  return NextResponse.json({ ok: true });
}
