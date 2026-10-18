-- CreateTable
CREATE TABLE "DeliverySettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "freeShippingThresholdRub" INTEGER NOT NULL DEFAULT 10000,
    "progressContentText" TEXT NOT NULL DEFAULT 'до бесплатной доставки в ПВЗ',
    "progressSuccessText" TEXT NOT NULL DEFAULT 'Бесплатная доставка!',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliverySettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "DeliverySettings" ("id", "freeShippingThresholdRub", "progressContentText", "progressSuccessText", "updatedAt")
VALUES ('default', 10000, 'до бесплатной доставки в ПВЗ', 'Бесплатная доставка!', CURRENT_TIMESTAMP);

-- CreateTable
CREATE TABLE "CmsPage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CmsPage_slug_key" ON "CmsPage"("slug");

-- CreateIndex
CREATE INDEX "CmsPage_isPublished_idx" ON "CmsPage"("isPublished");

-- Seed legal page shells (body filled by ETL)
INSERT INTO "CmsPage" ("id", "slug", "title", "bodyHtml", "isPublished", "publishedAt", "createdAt", "updatedAt")
VALUES
  ('cms_privacy', 'privacy', 'Политика конфиденциальности', '<p></p>', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_terms', 'terms', 'Оферта и условия пользования', '<p></p>', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cms_delivery', 'delivery', 'Оплата и доставка', '<p></p>', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
