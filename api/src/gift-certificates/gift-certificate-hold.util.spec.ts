import { describe, expect, it } from 'vitest';
import { computeGiftApplyAmount } from './gift-certificate-hold.util';

describe('computeGiftApplyAmount', () => {
  it('берёт min(balance, payable)', () => {
    expect(computeGiftApplyAmount(1000, 400)).toBe(400);
    expect(computeGiftApplyAmount(200, 500)).toBe(200);
    expect(computeGiftApplyAmount(0, 100)).toBe(0);
    expect(computeGiftApplyAmount(100, 0)).toBe(0);
  });
});
