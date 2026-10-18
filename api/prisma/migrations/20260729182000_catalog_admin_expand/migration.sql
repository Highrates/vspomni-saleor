-- AlterTable Product: rich fields + rename description
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "shortDescription" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "descriptionHtml" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "applicationHtml" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "compositionHtml" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "storageHtml" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "extraHtml" TEXT;

UPDATE "Product" SET "shortDescription" = "description" WHERE "description" IS NOT NULL;
ALTER TABLE "Product" DROP COLUMN IF EXISTS "description";

-- AlterTable ProductVariant: expand fields
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "nationalCatalogName" TEXT;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "volumeMl" INTEGER;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "orderMinQty" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "orderMaxQty" INTEGER;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "weightGrams" INTEGER;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "lengthMm" INTEGER;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "widthMm" INTEGER;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "heightMm" INTEGER;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "packageVolume" DOUBLE PRECISION;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "stockReserve" INTEGER NOT NULL DEFAULT 0;

UPDATE "ProductVariant" SET "name" = COALESCE("label", 'Вариант') WHERE "name" IS NULL;
UPDATE "ProductVariant" SET "slug" = lower(regexp_replace(COALESCE("label", id), '[^a-zA-Z0-9а-яА-ЯёЁ]+', '-', 'g')) WHERE "slug" IS NULL;

-- try parse volume from attrs.volume like '50 ml'
UPDATE "ProductVariant"
SET "volumeMl" = NULLIF(regexp_replace(COALESCE(attrs->>'volume', ''), '[^0-9]', '', 'g'), '')::int
WHERE "volumeMl" IS NULL AND attrs IS NOT NULL;

ALTER TABLE "ProductVariant" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "ProductVariant" ALTER COLUMN "slug" SET NOT NULL;

ALTER TABLE "ProductVariant" DROP COLUMN IF EXISTS "label";
ALTER TABLE "ProductVariant" DROP COLUMN IF EXISTS "attrs";

CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariant_productId_slug_key" ON "ProductVariant"("productId", "slug");

-- ProductVariantImage
CREATE TABLE IF NOT EXISTS "ProductVariantImage" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "productImageId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ProductVariantImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariantImage_variantId_productImageId_key" ON "ProductVariantImage"("variantId", "productImageId");

ALTER TABLE "ProductVariantImage" DROP CONSTRAINT IF EXISTS "ProductVariantImage_variantId_fkey";
ALTER TABLE "ProductVariantImage" ADD CONSTRAINT "ProductVariantImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductVariantImage" DROP CONSTRAINT IF EXISTS "ProductVariantImage_productImageId_fkey";
ALTER TABLE "ProductVariantImage" ADD CONSTRAINT "ProductVariantImage_productImageId_fkey" FOREIGN KEY ("productImageId") REFERENCES "ProductImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Collection
CREATE TABLE IF NOT EXISTS "Collection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Collection_slug_key" ON "Collection"("slug");

CREATE TABLE IF NOT EXISTS "CollectionItem" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CollectionItem_collectionId_productId_key" ON "CollectionItem"("collectionId", "productId");

ALTER TABLE "CollectionItem" DROP CONSTRAINT IF EXISTS "CollectionItem_collectionId_fkey";
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CollectionItem" DROP CONSTRAINT IF EXISTS "CollectionItem_productId_fkey";
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ProductSet
CREATE TABLE IF NOT EXISTS "ProductSet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductSet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductSet_slug_key" ON "ProductSet"("slug");

CREATE TABLE IF NOT EXISTS "ProductSetItem" (
    "id" TEXT NOT NULL,
    "productSetId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ProductSetItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductSetItem_productSetId_productId_key" ON "ProductSetItem"("productSetId", "productId");

ALTER TABLE "ProductSetItem" DROP CONSTRAINT IF EXISTS "ProductSetItem_productSetId_fkey";
ALTER TABLE "ProductSetItem" ADD CONSTRAINT "ProductSetItem_productSetId_fkey" FOREIGN KEY ("productSetId") REFERENCES "ProductSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductSetItem" DROP CONSTRAINT IF EXISTS "ProductSetItem_productId_fkey";
ALTER TABLE "ProductSetItem" ADD CONSTRAINT "ProductSetItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
