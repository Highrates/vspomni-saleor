import { describe, expect, it } from 'vitest';
import { peekJwtPayload } from './peekJwtPayload';

function makeJwt(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `hdr.${body}.sig`;
}

describe('peekJwtPayload', () => {
  it('читает role и exp', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const p = peekJwtPayload(makeJwt({ role: 'MODERATOR', exp }));
    expect(p?.role).toBe('MODERATOR');
    expect(p?.exp).toBe(exp);
  });

  it('на битом токене → null', () => {
    expect(peekJwtPayload('not-a-jwt')).toBeNull();
  });
});
