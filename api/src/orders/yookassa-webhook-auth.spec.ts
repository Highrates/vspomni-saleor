import { describe, expect, it } from 'vitest';
import {
  assertYookassaWebhookAuth,
  isYooKassaIp,
} from './yookassa-webhook-auth';

describe('yookassa-webhook-auth', () => {
  it('accepts documented YooKassa IPv4 ranges', () => {
    expect(isYooKassaIp('185.71.76.1')).toBe(true);
    expect(isYooKassaIp('77.75.156.11')).toBe(true);
    expect(isYooKassaIp('77.75.154.200')).toBe(true);
    expect(isYooKassaIp('8.8.8.8')).toBe(false);
  });

  it('rejects missing secret when configured', () => {
    expect(() =>
      assertYookassaWebhookAuth({
        secretConfigured: 's3cret',
        providedSecret: undefined,
        checkIp: false,
        clientIp: null,
      }),
    ).toThrow();
  });

  it('accepts matching secret', () => {
    expect(() =>
      assertYookassaWebhookAuth({
        secretConfigured: 's3cret',
        providedSecret: 's3cret',
        checkIp: false,
        clientIp: null,
      }),
    ).not.toThrow();
  });

  it('rejects wrong secret (timing-safe path)', () => {
    expect(() =>
      assertYookassaWebhookAuth({
        secretConfigured: 's3cret',
        providedSecret: 'wrong!',
        checkIp: false,
        clientIp: null,
      }),
    ).toThrow();
  });
});
