-- PromoCode.type: String → PromoCodeType enum (unknown → FIXED before cast)
CREATE TYPE "PromoCodeType" AS ENUM ('PERCENT', 'FIXED');

UPDATE "PromoCode"
SET "type" = 'FIXED'
WHERE "type" IS DISTINCT FROM 'PERCENT' AND "type" IS DISTINCT FROM 'FIXED';

ALTER TABLE "PromoCode"
  ALTER COLUMN "type" TYPE "PromoCodeType"
  USING ("type"::"PromoCodeType");
