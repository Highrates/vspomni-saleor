-- CreateTable
CREATE TABLE "HomepageSet" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomepageSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomepageSet_active_sortOrder_idx" ON "HomepageSet"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "HomepageSet_productId_idx" ON "HomepageSet"("productId");

-- AddForeignKey
ALTER TABLE "HomepageSet" ADD CONSTRAINT "HomepageSet_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
