-- CreateTable
CREATE TABLE "QuizContentEntry" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "plain" TEXT NOT NULL DEFAULT '',
    "html" TEXT NOT NULL DEFAULT '',
    "mediaUrl" TEXT,
    "mediaType" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizContentEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GratitudeGiftRule" (
    "id" TEXT NOT NULL,
    "minRub" INTEGER NOT NULL,
    "maxRub" INTEGER,
    "variantId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GratitudeGiftRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GratitudeProgramSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "articleSlug" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GratitudeProgramSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GratitudeGiftTier" (
    "id" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL DEFAULT '',
    "infoHtml" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GratitudeGiftTier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuizContentEntry_key_key" ON "QuizContentEntry"("key");

-- CreateIndex
CREATE INDEX "GratitudeGiftRule_active_sortOrder_idx" ON "GratitudeGiftRule"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "GratitudeGiftRule_variantId_idx" ON "GratitudeGiftRule"("variantId");

-- CreateIndex
CREATE INDEX "GratitudeGiftTier_active_sortOrder_idx" ON "GratitudeGiftTier"("active", "sortOrder");

-- AddForeignKey
ALTER TABLE "GratitudeGiftRule" ADD CONSTRAINT "GratitudeGiftRule_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
