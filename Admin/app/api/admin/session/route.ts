import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/getAdminSession';
import { ADMIN_ACCESS_TOKEN_COOKIE, adminCookieSecure } from '@/lib/adminAuth';

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session.authenticated) {
    if (session.error === 'api_unreachable') {
      return NextResponse.json({ authenticated: false, error: 'api_unreachable' });
    }
    const out = NextResponse.json({ authenticated: false });
    if (session.error === 'unauthorized') {
      out.cookies.set({
        name: ADMIN_ACCESS_TOKEN_COOKIE,
        value: '',
        httpOnly: true,
        secure: adminCookieSecure(request),
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      });
    }
    return out;
  }
  return NextResponse.json({ authenticated: true, user: session.user });
}
