export function normalizeApiV1Base(raw: string): string {
  const t = raw.replace(/\/+$/, '');
  if (/\/api\/v\d+$/i.test(t)) return t;
  if (/\/api$/i.test(t)) return `${t}/v1`;
  if (/^https?:\/\/[^/]+$/i.test(t)) return `${t}/api/v1`;
  return t;
}

export function getServerApiBase(): string {
  const raw =
    process.env.API_URL ??
    process.env.BACKEND_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://127.0.0.1:3001/api/v1';
  return normalizeApiV1Base(raw);
}
