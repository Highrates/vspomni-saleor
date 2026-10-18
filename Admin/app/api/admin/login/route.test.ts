import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_ACCESS_TOKEN_COOKIE } from '@/lib/adminAuth';

vi.mock('@/lib/serverApiBase', () => ({
  getServerApiBase: () => 'http://api.test/api/v1',
}));

vi.mock('@/lib/nestBff', () => ({
  readNestError: vi.fn(async () => null),
}));

vi.mock('@/lib/adminAuth', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/adminAuth')>();
  return {
    ...mod,
    adminCookieSecure: () => false,
  };
});

describe('POST /api/admin/login', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('ставит vspomni_admin_token для MODERATOR', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'jwt-mod' }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ role: 'MODERATOR', email: 'mod@jcos.local' }), {
          status: 200,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await import('./route');
    const req = new Request('http://localhost/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailOrPhone: 'moderator@jcos.local',
        password: 'change-me-moderator',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok?: boolean };
    expect(body.ok).toBe(true);

    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain(`${ADMIN_ACCESS_TOKEN_COOKIE}=jwt-mod`);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://api.test/api/v1/auth/admin/login',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://api.test/api/v1/auth/admin/me',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer jwt-mod' }),
      }),
    );
  });

  it('не ставит cookie для role=USER', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: 'jwt-user' }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ role: 'USER' }), { status: 200 }),
        ),
    );

    const { POST } = await import('./route');
    const res = await POST(
      new Request('http://localhost/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'buyer@jcos.local', password: 'password1' }),
      }),
    );

    expect(res.status).toBe(403);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeNull();
  });
});
