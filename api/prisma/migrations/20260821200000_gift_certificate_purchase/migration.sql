-- AlterTable
ALTER TABLE "Order" ADD COLUMN "giftPurchaseDenominationId" TEXT,
ADD COLUMN "giftPurchaseRecipientEmail" TEXT;

-- CreateIndex
CREATE INDEX "Order_giftPurchaseDenominationId_idx" ON "Order"("giftPurchaseDenominationId");

-- CreateIndex
CREATE INDEX "GiftCertificate_purchaseOrderId_idx" ON "GiftCertificate"("purchaseOrderId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_giftPurchaseDenominationId_fkey" FOREIGN KEY ("giftPurchaseDenominationId") REFERENCES "GiftCertificateDenomination"("id") ON DELETE SET NULL ON UPDATE CASCADE;
