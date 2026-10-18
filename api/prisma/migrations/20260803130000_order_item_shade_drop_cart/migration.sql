-- Drop unused server-side cart (storefront = localStorage + catalog/cart/sync).
DROP TABLE IF EXISTS "CartItem";
DROP TABLE IF EXISTS "Cart";

-- Persist chosen shade on order line.
ALTER TABLE "OrderItem" ADD COLUMN "shadeId" TEXT;

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_shadeId_fkey"
  FOREIGN KEY ("shadeId") REFERENCES "ProductVariantShade"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
