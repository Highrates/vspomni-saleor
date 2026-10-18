-- Convert rule conditions from free text to structured JSON
ALTER TABLE "DiscountRule" DROP COLUMN IF EXISTS "conditions";
ALTER TABLE "DiscountRule" ADD COLUMN "conditions" JSONB;
