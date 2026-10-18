-- AlterTable
ALTER TABLE "Order" ADD COLUMN "giftCertificateCode" TEXT,
ADD COLUMN "giftCertificateId" TEXT,
ADD COLUMN "giftCertificateAmount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Order_giftCertificateId_idx" ON "Order"("giftCertificateId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_giftCertificateId_fkey" FOREIGN KEY ("giftCertificateId") REFERENCES "GiftCertificate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
