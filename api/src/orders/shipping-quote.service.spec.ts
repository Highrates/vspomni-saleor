import { createHmac, timingSafeEqual } from 'crypto';
import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import {
  hashCartLines,
  hashShippingAddress,
  ShippingQuoteService,
} from './shipping-quote.service';

function makeService() {
  const config = {
    get: (key: string) => {
      if (key === 'ORDER_PAY_SECRET') return 'test-pay-secret-for-shipping-quote';
      if (key === 'SHIPPING_QUOTE_TTL_SECONDS') return '900';
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    },
  };
  return new ShippingQuoteService(config as never);
}

describe('hashShippingAddress / hashCartLines', () => {
  it('стабилен к регистру города', () => {
    const a = hashShippingAddress(
      { city: 'Москва', address: 'Тверская 1', comment: 'СДЭК ПВЗ' },
      'cdek',
    );
    const b = hashShippingAddress(
      { city: 'москва', address: 'Тверская 1', comment: 'СДЭК ПВЗ' },
      'CDEK',
    );
    expect(a).toBe(b);
  });

  it('lines hash не зависит от порядка', () => {
    const a = hashCartLines([
      { variantId: 'v2', qty: 1 },
      { variantId: 'v1', shadeId: 's', qty: 2 },
    ]);
    const b = hashCartLines([
      { variantId: 'v1', shadeId: 's', qty: 2 },
      { variantId: 'v2', qty: 1 },
    ]);
    expect(a).toBe(b);
  });
});

describe('ShippingQuoteService', () => {
  it('issue + verify roundtrip', () => {
    const svc = makeService();
    const { quote, payload } = svc.issue({
      cost: 349,
      method: 'CDEK',
      addrHash: 'abc',
      linesHash: 'def',
      goodsSubtotal: 5000,
      freePvz: false,
    });
    const verified = svc.verify(quote);
    expect(verified.cost).toBe(349);
    expect(verified.method).toBe('CDEK');
    expect(verified.exp).toBe(payload.exp);
  });

  it('отклоняет подделанную стоимость', () => {
    const svc = makeService();
    const { quote } = svc.issue({
      cost: 349,
      method: 'CDEK',
      addrHash: 'abc',
      linesHash: 'def',
      goodsSubtotal: 5000,
      freePvz: false,
    });
    const [body] = quote.split('.');
    const tamperedPayload = JSON.parse(
      Buffer.from(body!, 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
    tamperedPayload.cost = 1;
    const tamperedBody = Buffer.from(
      JSON.stringify(tamperedPayload),
      'utf8',
    ).toString('base64url');
    // чужая подпись
    const fakeSig = createHmac('sha256', 'wrong')
      .update(`shipping-quote.v1.${tamperedBody}`)
      .digest('base64url');
    expect(() => svc.verify(`${tamperedBody}.${fakeSig}`)).toThrow(
      BadRequestException,
    );
    // старая подпись от другого body
    const [, origSig] = quote.split('.');
    expect(() => svc.verify(`${tamperedBody}.${origSig}`)).toThrow(
      BadRequestException,
    );
    expect(timingSafeEqual(Buffer.from('aa'), Buffer.from('aa'))).toBe(true);
  });
});
