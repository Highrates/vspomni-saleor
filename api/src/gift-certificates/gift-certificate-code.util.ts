import { randomBytes } from 'node:crypto';

/** Без 0/O/1/I — удобнее диктовать и вводить. */
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const UNBIASED_MAX = 256 - (256 % CHARSET.length);

export function normalizeGiftCertificateCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

/** Код вида JC-XXXX-XXXX-XXXX */
export function generateGiftCertificateCode(): string {
  const body = randomChunk(12);
  return `JC-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`;
}

function randomChunk(length: number): string {
  let out = '';
  while (out.length < length) {
    const bytes = randomBytes(Math.max(32, length - out.length));
    for (const b of bytes) {
      if (b >= UNBIASED_MAX) continue;
      out += CHARSET[b % CHARSET.length]!;
      if (out.length >= length) break;
    }
  }
  return out;
}
