import { NextResponse } from 'next/server';
import {
  ADMIN_ACCESS_TOKEN_COOKIE,
  ADMIN_TOKEN_MAX_AGE_SEC,
  adminCookieSecure,
} from '@/lib/adminAuth';
import { isAdminStaffRole } from '@/lib/adminStaffRole';
import { readNestError } from '@/lib/nestBff';
import { getServerApiBase } from '@/lib/serverApiBase';

const MSG_401 =
  'Неверный логин или пароль. Если админа ещё не создавали: cd backend && npx prisma db seed';

export async function POST(request: Request) {
  let body: { email?: string; emailOrPhone?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const emailOrPhone = (body.emailOrPhone ?? body.email ?? '').trim();
  // Пароль не trim: пробелы допустимы (как в форме и на backend).
  const password = body.password ?? '';
  if (!emailOrPhone || !password) {
    return NextResponse.json({ error: 'Укажите email и пароль' }, { status: 400 });
  }

  const url = `${getServerApiBase()}/auth/admin/login`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailOrPhone: emailOrPhone.includes('@')
          ? emailOrPhone.toLowerCase()
          : emailOrPhone,
        password,
      }),
    });
  } catch {
    return NextResponse.json(
      { error: 'Нет связи с API. Запустите backend (порт 3001).' },
      { status: 502 },
    );
  }

  if (!res.ok) {
    if (res.status === 401) {
      return NextResponse.json({ error: MSG_401 }, { status: 401 });
    }
    const nestMsg = await readNestError(res);
    return NextResponse.json(
      { error: nestMsg ?? `Ошибка API (${res.status})` },
      { status: res.status },
    );
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    return NextResponse.json(
      { error: 'Нет access_token в ответе API' },
      { status: 502 },
    );
  }

  // Та же проверка, что у layout/session: /auth/admin/me (AdminGuard), не /auth/me.
  try {
    const meRes = await fetch(`${getServerApiBase()}/auth/admin/me`, {
      headers: { Authorization: `Bearer ${data.access_token}` },
      cache: 'no-store',
    });
    if (!meRes.ok) {
      return NextResponse.json({ error: 'Не удалось проверить сессию' }, { status: 502 });
    }
    const user = (await meRes.json()) as { role?: string };
    if (!isAdminStaffRole(user.role)) {
      return NextResponse.json(
        { error: 'Этот аккаунт не является сотрудником админки' },
        { status: 403 },
      );
    }
  } catch {
    return NextResponse.json({ error: 'Не удалось проверить сессию' }, { status: 502 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_ACCESS_TOKEN_COOKIE,
    value: data.access_token,
    httpOnly: true,
    secure: adminCookieSecure(request),
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_TOKEN_MAX_AGE_SEC,
  });
  return response;
}
