-- CreateTable
CREATE TABLE "MenuSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "productId" TEXT,
    "annotationText" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MenuSettings_productId_idx" ON "MenuSettings"("productId");

-- AddForeignKey
ALTER TABLE "MenuSettings" ADD CONSTRAINT "MenuSettings_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
