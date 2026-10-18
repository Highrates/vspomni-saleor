import { Prisma } from '@prisma/client';
import { generateGiftCertificateCode } from './gift-certificate-code.util';

export async function allocateUniqueGiftCode(
  db: { giftCertificate: { findUnique: Prisma.GiftCertificateDelegate['findUnique'] } },
  maxAttempts = 12,
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateGiftCertificateCode();
    const exists = await db.giftCertificate.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  throw new Error('Не удалось выделить уникальный код сертификата');
}
