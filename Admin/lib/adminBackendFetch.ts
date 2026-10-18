/** Прокси к Nest под тем же origin; JWT из httpOnly-cookie на сервере маршрута. */
export function adminBackendPath(apiPath: string): string {
  const clean = apiPath.replace(/^\/+/, '');
  return `/api/admin/backend/${clean}`;
}

export async function adminBackendFetch(apiPath: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const body = init?.body;
  if (
    body &&
    !headers.has('Content-Type') &&
    !(body instanceof FormData) &&
    !(body instanceof Blob) &&
    !(body instanceof URLSearchParams)
  ) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(adminBackendPath(apiPath), {
    credentials: 'same-origin',
    ...init,
    headers,
  });
}

/** Ошибка прокси `/api/admin/backend/*` с HTTP-статусом Nest. */
export class AdminBackendRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminBackendRequestError';
    this.status = status;
  }
}

export async function readAdminApiError(res: Response): Promise<string> {
  let msg = res.statusText;
  try {
    const j = await res.json();
    if (typeof j?.message === 'string') msg = j.message;
    else if (Array.isArray(j?.message)) msg = j.message.join(', ');
  } catch {
    try {
      msg = await res.text();
    } catch {
      /* ignore */
    }
  }
  return msg || `HTTP ${res.status}`;
}

export async function adminBackendJson<T>(apiPath: string, init?: RequestInit): Promise<T> {
  const res = await adminBackendFetch(apiPath, init);
  if (!res.ok) {
    throw new AdminBackendRequestError(await readAdminApiError(res), res.status);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text.trim()) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AdminBackendRequestError('Некорректный ответ сервера', res.status);
  }
}
