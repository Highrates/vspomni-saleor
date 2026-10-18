import { NextResponse } from 'next/server';
import { ADMIN_ACCESS_TOKEN_COOKIE, adminCookieSecure } from '@/lib/adminAuth';

export async function POST(request: Request) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: ADMIN_ACCESS_TOKEN_COOKIE,
    value: '',
    httpOnly: true,
    secure: adminCookieSecure(request),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
