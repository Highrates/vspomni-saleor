-- CreateEnum
CREATE TYPE "ProductAromaNoteKind" AS ENUM ('BASIC', 'MIDDLE', 'HEAD');

-- CreateTable
CREATE TABLE "ProductAromaNote" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kind" "ProductAromaNoteKind" NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAromaNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductAromaNote_productId_kind_sortOrder_idx" ON "ProductAromaNote"("productId", "kind", "sortOrder");

-- AddForeignKey
ALTER TABLE "ProductAromaNote" ADD CONSTRAINT "ProductAromaNote_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
