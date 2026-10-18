-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN "onecId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "onecExportedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_onecId_key" ON "ProductVariant"("onecId");

-- CreateIndex
CREATE INDEX "Order_onecExportedAt_status_idx" ON "Order"("onecExportedAt", "status");
