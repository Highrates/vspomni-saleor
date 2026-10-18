import { randomBytes } from 'node:crypto';

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
/** Rejection sampling: отбрасываем байты ≥ floor, чтобы убрать modulo bias. */
const UNBIASED_MAX = 256 - (256 % CHARSET.length);

export function generateStaffPassword(length = 14): string {
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
