/**
 * HTTP-клиент Nest `/api/v1` для Next.js (RSC + client components).
 *
 * - Браузер: same-origin `/api/v1` → BFF (httpOnly cookie → Bearer). Не localStorage.
 * - RSC/Node: абсолютный Nest URL; токен только через `options.token`.
 * - `NEXT_PUBLIC_API_DIRECT=1`: прямой Nest + legacy localStorage (NEST_LIVE).
 * - Пароль регистрации — in-memory (см. registerSession.ts).
 */

import { notifyUnauthorized } from '@/api/authSession'
import { clearRegisterPassword } from '@/api/registerSession'
import { toRelativeMediaPath } from '@vspomni/media-path'

const DEFAULT_API_URL = 'http://127.0.0.1:3011/api/v1'

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

/** Абсолютный base URL Nest API без trailing slash. */
export function apiBase(): string {
  const envRaw = process.env.NEXT_PUBLIC_API_URL?.trim() || ''
  /**
   * Браузер: same-origin `/api/v1` → Next rewrite (нет CORS 127↔localhost).
   * Absolute `NEXT_PUBLIC_API_URL` в браузере только с `NEXT_PUBLIC_API_DIRECT=1`
   * (NEST_LIVE / отладка). RSC/Node всегда может бить в Nest напрямую.
   */
  if (typeof window !== 'undefined') {
    const direct =
      process.env.NEXT_PUBLIC_API_DIRECT === '1' &&
      /^https?:\/\//i.test(envRaw)
    if (direct) return envRaw.replace(/\/+$/, '')
    if (envRaw.startsWith('/')) return envRaw.replace(/\/+$/, '') || '/api/v1'
    return '/api/v1'
  }
  let raw = envRaw || DEFAULT_API_URL
  // Старый Saleor GraphQL URL в окружении — не используем как Nest.
  if (/\/graphql\/?$/i.test(raw)) raw = DEFAULT_API_URL
  // Относительный путь (/api/v1): на сервере нужен origin.
  if (raw.startsWith('/')) {
    raw = `${new URL(DEFAULT_API_URL).origin}${raw}`
  }
  return raw.replace(/\/+$/, '')
}

/**
 * Origin, где лежат `/uploads/*` (Nest).
 * `same-origin` / `.` — относительные `/uploads/…` (nginx / Next rewrite на том же хосте).
 *
 * В браузере по умолчанию same-origin: иначе картинки уходят на `127.0.0.1:3011`
 * и на телефоне (LAN) / при localhost≠127 баннеры пустые.
 */
export function uploadsOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_UPLOADS_ORIGIN?.trim()
  if (explicit === 'same-origin' || explicit === '.') return ''
  if (explicit) return explicit.replace(/\/+$/, '')
  // Relative `/uploads` в HTML (браузер + RSC): иначе в разметке торчит
  // `http://127.0.0.1:3011/...` и на телефоне (LAN) баннеры пустые.
  if (process.env.NEXT_PUBLIC_API_DIRECT !== '1') {
    return ''
  }
  try {
    const base = apiBase()
    if (base.startsWith('/')) return new URL(DEFAULT_API_URL).origin
    return new URL(base).origin
  } catch {
    return new URL(DEFAULT_API_URL).origin
  }
}

function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

/** Статика Front (`public/`), не Nest `/uploads` */
function isFrontPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith('/images/') ||
    pathname.startsWith('/logo/') ||
    pathname.startsWith('/fonts/') ||
    pathname.startsWith('/favicon')
  )
}

/**
 * Абсолютный URL медиа с Nest.
 * Path-нормализация — `toRelativeMediaPath`; origin — только здесь (витрина).
 * - relative `/uploads/x` → `${uploadsOrigin}/uploads/x` (в браузере → `/uploads/x`)
 * - relative `/images/…` → как есть (Front public)
 * - absolute localhost/vspomni `/uploads` → uploadsOrigin
 * - внешние URL и data: — без изменений
 */
export function uploadsUrl(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null
  const s = pathOrUrl.trim()
  if (!s) return null
  if (s.startsWith('data:')) return s
  if (s.startsWith('//')) return `https:${s}`
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s)
      const rel = toRelativeMediaPath(s)
      if (rel.startsWith('/') && !/^https?:/i.test(rel)) {
        if (isFrontPublicPath(rel)) return rel
        // localhost / staging: DNS vspomni.store ещё на старом VPS → 404 в /_next/image
        if (
          rel.startsWith('/uploads') &&
          (isLocalHost(u.hostname) ||
            u.hostname === 'vspomni.store' ||
            u.hostname === 'www.vspomni.store')
        ) {
          return `${uploadsOrigin()}${rel}`
        }
      }
    } catch {
      /* fall through */
    }
    return s
  }
  const path = toRelativeMediaPath(s.startsWith('/') ? s : `/${s}`)
  if (isFrontPublicPath(path)) return path
  return `${uploadsOrigin()}${path}`
}

function apiDirectBrowser(): boolean {
  return (
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_API_DIRECT === '1'
  )
}

/** Legacy / NEST_LIVE only. В обычном браузере JWT в httpOnly cookie (BFF). */
export function getAccessToken(): string | null {
  if (!apiDirectBrowser()) return null
  try {
    const t = localStorage.getItem('token')
    return t && t !== 'null' && t !== 'undefined' ? t : null
  } catch {
    return null
  }
}

/** После login cookie ставит BFF; здесь только legacy DIRECT или сброс localStorage. */
export function setAccessToken(token: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (!token || !apiDirectBrowser()) {
      localStorage.removeItem('token')
      return
    }
    localStorage.setItem('token', token)
  } catch {
    /* Safari private mode */
  }
}

export function clearAuthStorage() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('userId')
    localStorage.removeItem('email')
    sessionStorage.removeItem('vspomni.register.completionToken')
    sessionStorage.removeItem('vspomni.register.otpSent')
    sessionStorage.removeItem('vspomni_auth_return')
  } catch {
    /* ignore */
  }
  // Guest id (vspomni.guest.v1) не трогаем — нужен для claim заказов.
  clearRegisterPassword()
}

export const GUEST_KEY = 'vspomni.guest.v1'
export const REGISTER_COMPLETION_KEY = 'vspomni.register.completionToken'
export const REGISTER_OTP_SENT_KEY = 'vspomni.register.otpSent'

export function getOrCreateGuestId(): string {
  if (typeof window === 'undefined') return ''
  try {
    let id = localStorage.getItem(GUEST_KEY)?.trim() || ''
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `g-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      localStorage.setItem(GUEST_KEY, id)
    }
    return id
  } catch {
    return ''
  }
}

export type ApiFetchOptions = RequestInit & {
  /** Не прикреплять Bearer (login/register). */
  skipAuth?: boolean
  /** Не чистить сессию и не звать notifyUnauthorized на 401 (например, logout). */
  skipUnauthorizedNotify?: boolean
  /** Query string object. */
  query?: Record<string, string | number | boolean | undefined | null>
  /** Явный Bearer (server-side вызовы с токеном из cookie/header). */
  token?: string | null
}

function buildUrl(path: string, query?: ApiFetchOptions['query']): string {
  const p = path.startsWith('/') ? path : `/${path}`
  const base = `${apiBase()}${p}`
  if (!query) return base
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue
    sp.set(k, String(v))
  }
  const q = sp.toString()
  return q ? `${base}?${q}` : base
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const {
    skipAuth,
    skipUnauthorizedNotify,
    query,
    token: explicitToken,
    headers: hdrs,
    ...init
  } = options
  const headers = new Headers(hdrs)
  if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (!skipAuth) {
    const token = explicitToken ?? getAccessToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(buildUrl(path, query), {
    // RSC: не кэшируем публичные ответы между деплоями/правками из админки
    cache: 'no-store',
    ...init,
    // same-origin BFF: httpOnly cookie (после …init, чтобы не перетёрли)
    credentials:
      typeof window !== 'undefined' && !apiDirectBrowser()
        ? 'same-origin'
        : init.credentials,
    headers,
  })

  const text = await res.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }

  if (!res.ok) {
    const msg =
      body && typeof body === 'object' && 'message' in body
        ? Array.isArray((body as { message: unknown }).message)
          ? (body as { message: string[] }).message.join(', ')
          : String((body as { message: unknown }).message)
        : body && typeof body === 'object' && 'error' in body
          ? String((body as { error: unknown }).error)
          : `HTTP ${res.status}`
    if (res.status === 401 && !skipAuth && !skipUnauthorizedNotify) {
      clearAuthStorage()
      notifyUnauthorized()
    }
    throw new ApiError(msg || `HTTP ${res.status}`, res.status, body)
  }

  return body as T
}

export async function apiJson<T = unknown>(
  path: string,
  method: string,
  body?: unknown,
  options: Omit<ApiFetchOptions, 'method' | 'body'> = {},
): Promise<T> {
  return apiFetch<T>(path, {
    ...options,
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
