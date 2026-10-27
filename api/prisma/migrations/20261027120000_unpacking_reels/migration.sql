-- CreateTable
CREATE TABLE "UnpackingReel" (
    "id" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "posterUrl" TEXT NOT NULL,
    "captionName" TEXT,
    "captionDate" DATE,
    "productId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnpackingReel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UnpackingReel_active_sortOrder_idx" ON "UnpackingReel"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "UnpackingReel_productId_idx" ON "UnpackingReel"("productId");

-- AddForeignKey
ALTER TABLE "UnpackingReel" ADD CONSTRAINT "UnpackingReel_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
