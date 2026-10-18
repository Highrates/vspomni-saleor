import { NextResponse } from 'next/server';
import { readNestError } from '@/lib/nestBff';
import { getServerApiBase } from '@/lib/serverApiBase';

/** POST /api/auth/register/verify → Nest register/verify. */
export async function POST(request: Request) {
  let body: { email?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const code = typeof body.code === 'string' ? body.code.trim() : '';

  if (!email) {
    return NextResponse.json({ error: 'Укажите email' }, { status: 400 });
  }
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: 'Код должен состоять из 6 цифр' },
      { status: 400 },
    );
  }

  let res: Response;
  try {
    res = await fetch(`${getServerApiBase()}/auth/register/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
  } catch {
    return NextResponse.json({ error: 'Нет связи с API' }, { status: 502 });
  }

  if (!res.ok) {
    const nestMsg = await readNestError(res);
    return NextResponse.json(
      { error: nestMsg ?? 'Неверный код' },
      { status: res.status },
    );
  }

  const data = (await res.json()) as { completionToken?: string };
  if (!data.completionToken) {
    return NextResponse.json({ error: 'Нет completionToken' }, { status: 502 });
  }

  return NextResponse.json({ ok: true, completionToken: data.completionToken });
}
