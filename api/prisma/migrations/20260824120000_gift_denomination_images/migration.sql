-- Галерея номиналов подарочных сертификатов

CREATE TABLE "GiftCertificateDenominationImage" (
    "id" TEXT NOT NULL,
    "denominationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL DEFAULT 'image',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftCertificateDenominationImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GiftCertificateDenominationImage_denominationId_sortOrder_idx" ON "GiftCertificateDenominationImage"("denominationId", "sortOrder");

ALTER TABLE "GiftCertificateDenominationImage" ADD CONSTRAINT "GiftCertificateDenominationImage_denominationId_fkey" FOREIGN KEY ("denominationId") REFERENCES "GiftCertificateDenomination"("id") ON DELETE CASCADE ON UPDATE CASCADE;
