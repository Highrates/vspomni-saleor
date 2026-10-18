import { timingSafeEqual } from 'crypto';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

/**
 * Официальные диапазоны ЮKassa для webhook:
 * https://yookassa.ru/developers/using-api/webhooks
 */
const YOOKASSA_CIDRS = [
  '185.71.76.0/27',
  '185.71.77.0/27',
  '77.75.153.0/25',
  '77.75.154.128/25',
] as const;

const YOOKASSA_EXACT_IPS = new Set(['77.75.156.11', '77.75.156.35']);

const YOOKASSA_IPV6_PREFIX = '2a02:5180:';

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const octet = Number(p);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    n = (n << 8) + octet;
  }
  return n >>> 0;
}

function inCidr(ip: string, cidr: string): boolean {
  const [base, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const ipN = ipv4ToInt(ip);
  const baseN = ipv4ToInt(base);
  if (ipN == null || baseN == null) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipN & mask) === (baseN & mask);
}

export function isYooKassaIp(raw: string): boolean {
  const ip = raw.trim().replace(/^\[|\]$/g, '');
  if (!ip || ip === '::1' || ip === '127.0.0.1') return false;
  if (YOOKASSA_EXACT_IPS.has(ip)) return true;
  if (ip.toLowerCase().startsWith(YOOKASSA_IPV6_PREFIX)) return true;
  // IPv4-mapped IPv6
  const v4 =
    ip.startsWith('::ffff:') ? ip.slice(7) : ip.includes('.') ? ip : null;
  if (!v4) return false;
  return YOOKASSA_CIDRS.some((c) => inCidr(v4, c));
}

/** Первый публичный hop из X-Forwarded-For / X-Real-IP. */
export function clientIpFromHeaders(
  headers: Record<string, string | string[] | undefined>,
  fallback?: string | null,
): string | null {
  const xff = headers['x-forwarded-for'];
  const first =
    typeof xff === 'string'
      ? xff.split(',')[0]?.trim()
      : Array.isArray(xff)
        ? xff[0]?.split(',')[0]?.trim()
        : null;
  if (first) return first;
  const real = headers['x-real-ip'];
  if (typeof real === 'string' && real.trim()) return real.trim();
  if (Array.isArray(real) && real[0]?.trim()) return real[0].trim();
  return fallback?.trim() || null;
}

export function secretsEqual(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

export function assertYookassaWebhookAuth(opts: {
  secretConfigured: string | undefined;
  providedSecret: string | undefined;
  checkIp: boolean;
  clientIp: string | null;
}) {
  const expected = opts.secretConfigured?.trim();
  if (expected) {
    const got = opts.providedSecret?.trim() ?? '';
    if (!got || !secretsEqual(expected, got)) {
      throw new UnauthorizedException('Webhook secret invalid');
    }
  }

  if (opts.checkIp) {
    if (!opts.clientIp || !isYooKassaIp(opts.clientIp)) {
      throw new ForbiddenException('Webhook IP not allowed');
    }
  }
}
