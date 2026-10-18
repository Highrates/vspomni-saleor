import { describe, expect, it, vi } from 'vitest';
import { GiftCertificateStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { holdGiftCertificateForOrder } from './gift-certificate-hold.util';

function mockTx(lockRow: Record<string, unknown>) {
  return {
    $queryRaw: vi.fn().mockImplementation(async (strings: TemplateStringsArray) => {
      const sql = String(strings);
      if (sql.includes('current_setting')) return [{ v: 'off' }];
      return [lockRow];
    }),
    $executeRaw: vi.fn().mockResolvedValue(undefined),
    giftCertificate: {
      update: vi.fn().mockResolvedValue({}),
    },
    giftCertificateLedger: {
      create: vi.fn().mockResolvedValue({}),
    },
  };
}

describe('holdGiftCertificateForOrder concurrency', () => {
  it('берёт сертификат под FOR UPDATE перед CAPTURE', async () => {
    const tx = mockTx({
      id: 'c1',
      code: 'JC-AAAA-BBBB-CCCC',
      balance: 1000,
      faceValue: 1000,
      status: GiftCertificateStatus.ACTIVE,
      expiresAt: null,
    });

    await holdGiftCertificateForOrder(tx as never, {
      certificateId: 'c1',
      orderId: 'ord1',
      applyAmount: 400,
    });

    const lockCall = tx.$queryRaw.mock.calls.find((c) =>
      String(c[0] ?? '').match(/FOR UPDATE/i),
    );
    expect(lockCall).toBeTruthy();
    expect(tx.giftCertificate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ balance: 600 }),
      }),
    );
  });

  it('не даёт списать больше баланса (после lock)', async () => {
    const tx = mockTx({
      id: 'c1',
      code: 'JC-AAAA-BBBB-CCCC',
      balance: 100,
      faceValue: 1000,
      status: GiftCertificateStatus.ACTIVE,
      expiresAt: null,
    });

    await expect(
      holdGiftCertificateForOrder(tx as never, {
        certificateId: 'c1',
        orderId: 'ord1',
        applyAmount: 400,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.giftCertificate.update).not.toHaveBeenCalled();
  });
});
