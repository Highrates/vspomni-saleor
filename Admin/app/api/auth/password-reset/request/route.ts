import { NextResponse } from 'next/server';
import { readNestError } from '@/lib/nestBff';
import { getServerApiBase } from '@/lib/serverApiBase';

export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: 'Укажите email' }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`${getServerApiBase()}/auth/password-reset/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
  } catch {
    return NextResponse.json({ error: 'Нет связи с API' }, { status: 502 });
  }

  if (!res.ok) {
    const nestMsg = await readNestError(res);
    return NextResponse.json(
      { error: nestMsg ?? 'Не удалось отправить' },
      { status: res.status },
    );
  }

  const data = (await res.json()) as { message?: string; devHint?: string };
  return NextResponse.json(data);
}
