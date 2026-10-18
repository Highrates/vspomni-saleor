import { GiftCertificateStatus, Prisma } from '@prisma/client';

/** ACTIVE + expiresAt ≤ now → EXPIRED. */
export async function expireOverdueGiftCertificates(
  db: {
    giftCertificate: {
      updateMany: Prisma.GiftCertificateDelegate['updateMany'];
    };
  },
  now = new Date(),
): Promise<number> {
  const result = await db.giftCertificate.updateMany({
    where: {
      status: GiftCertificateStatus.ACTIVE,
      expiresAt: { lte: now },
    },
    data: { status: GiftCertificateStatus.EXPIRED },
  });
  return result.count;
}
