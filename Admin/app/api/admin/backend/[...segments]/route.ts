import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_ACCESS_TOKEN_COOKIE } from '@/lib/adminAuth';
import { isAllowedAdminBackendPath } from '@/lib/adminBackendAllowlist';
import { getServerApiBase } from '@/lib/serverApiBase';
import { rejectForeignOriginMutations } from '@/lib/adminMutatingOrigin';

export const runtime = 'nodejs';

/**
 * Undici при следовании 301/302 часто шлёт второй запрос GET без тела.
 * `redirect: 'manual'`, затем повтор POST/PUT/PATCH с копией тела.
 */
async function fetchUpstream(
  target: string,
  method: string,
  init: RequestInit,
  bodyBackup: ArrayBuffer | FormData | null,
): Promise<Response> {
  let res = await fetch(target, { ...init, redirect: 'manual' });

  const hasBody =
    init.body != null && (method === 'POST' || method === 'PUT' || method === 'PATCH');
  const loc = res.headers.get('location');
  const retryPost = hasBody && loc != null && [301, 302, 307, 308].includes(res.status);

  if (retryPost) {
    try {
      await res.arrayBuffer();
    } catch {
      /* ignore */
    }
    const nextUrl = new URL(loc, target).href;
    let retryBody: BodyInit | null | undefined = init.body;
    if (bodyBackup instanceof ArrayBuffer && bodyBackup.byteLength > 0) {
      retryBody = bodyBackup.slice(0);
    } else if (bodyBackup instanceof FormData) {
      retryBody = bodyBackup;
    }
    res = await fetch(nextUrl, {
      ...init,
      body: retryBody,
      redirect: 'manual',
    });
  }

  return res;
}

async function proxy(request: NextRequest, segments: string[], method: string) {
  try {
    const originBlock = rejectForeignOriginMutations(request);
    if (originBlock) return originBlock;

    if (!isAllowedAdminBackendPath(segments)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    const token = cookies().get(ADMIN_ACCESS_TOKEN_COOKIE)?.value;
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const path = segments.join('/');
    const url = new URL(request.url);
    const target = `${getServerApiBase()}/${path}${url.search}`;

    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    const init: RequestInit = { method, headers, cache: 'no-store' };

    let bodyBackup: ArrayBuffer | FormData | null = null;

    if (!['GET', 'HEAD'].includes(method)) {
      const ct = request.headers.get('content-type') ?? '';
      if (ct.includes('multipart/form-data')) {
        // Пересобираем FormData — undici сам выставит boundary (сырой buffer часто ломает multer).
        const incoming = await request.formData();
        const outgoing = new FormData();
        for (const [key, value] of incoming.entries()) {
          if (typeof value === 'string') {
            outgoing.append(key, value);
          } else {
            // File/Blob: явное имя — иначе multer иногда видит пустой file
            const name =
              typeof (value as File).name === 'string' && (value as File).name
                ? (value as File).name
                : 'upload.bin';
            outgoing.append(key, value, name);
          }
        }
        if (![...outgoing.keys()].length) {
          return NextResponse.json({ message: 'Пустое тело запроса' }, { status: 400 });
        }
        init.body = outgoing;
        bodyBackup = outgoing;
        // Content-Type с boundary задаёт fetch — не копируем входящий
      } else {
        const body = await request.arrayBuffer();
        if (body.byteLength > 0) {
          if (ct) headers['Content-Type'] = ct;
          headers['Content-Length'] = String(body.byteLength);
          init.body = body;
          bodyBackup = body;
        }
      }
    }

    let res: Response;
    try {
      res = await fetchUpstream(target, method, init, bodyBackup);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[admin/backend proxy] upstream fetch failed', target, msg);
      return NextResponse.json(
        { message: `Не удалось связаться с API: ${msg}` },
        { status: 502 },
      );
    }

    const outCt = res.headers.get('content-type') ?? '';
    // Nest должен отдавать JSON; HTML 500 обычно значит неверный API_URL (попали во Front).
    if (res.status >= 500 && outCt.includes('text/html')) {
      console.error(
        '[admin/backend proxy] upstream returned HTML',
        res.status,
        target,
        'check API_URL / NEXT_PUBLIC_API_URL (Nest :3011, not Front)',
      );
      return NextResponse.json(
        {
          message:
            'API вернул HTML вместо JSON — проверьте API_URL / NEXT_PUBLIC_API_URL (должен быть Nest :3011/api/v1)',
        },
        { status: 502 },
      );
    }

    const out = new NextResponse(res.body, { status: res.status });
    if (outCt) out.headers.set('content-type', outCt);
    return out;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[admin/backend proxy] fatal', msg);
    return NextResponse.json({ message: msg || 'Ошибка прокси' }, { status: 500 });
  }
}

type Ctx = { params: { segments: string[] } };

export async function GET(request: NextRequest, { params }: Ctx) {
  return proxy(request, params.segments, 'GET');
}

export async function POST(request: NextRequest, { params }: Ctx) {
  return proxy(request, params.segments, 'POST');
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  return proxy(request, params.segments, 'PATCH');
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  return proxy(request, params.segments, 'PUT');
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  return proxy(request, params.segments, 'DELETE');
}
