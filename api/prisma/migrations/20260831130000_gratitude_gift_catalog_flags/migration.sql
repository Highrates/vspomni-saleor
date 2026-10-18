-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "excludeFromCatalog" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "isGratitudeGift" BOOLEAN NOT NULL DEFAULT false;

-- Gift SKUs used in gratitude rules: hide from catalog, keep active for attach
UPDATE "Product" p
SET "excludeFromCatalog" = true
WHERE p.id IN (
  SELECT DISTINCT pv."productId"
  FROM "GratitudeGiftRule" r
  JOIN "ProductVariant" pv ON pv.id = r."variantId"
  WHERE r.active = true
);
