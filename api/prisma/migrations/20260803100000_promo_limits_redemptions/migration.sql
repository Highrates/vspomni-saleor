-- AlterTable
ALTER TABLE "PromoCode" ADD COLUMN IF NOT EXISTS "maxUses" INTEGER;
ALTER TABLE "PromoCode" ADD COLUMN IF NOT EXISTS "oneShot" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PromoCode" ADD COLUMN IF NOT EXISTS "minOrderAmount" INTEGER;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PromoCodeRedemption" (
    "id" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountAmount" INTEGER NOT NULL,
    "email" TEXT,
    "userId" TEXT,
    "guestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoCodeRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PromoCodeRedemption_orderId_key" ON "PromoCodeRedemption"("orderId");
CREATE INDEX IF NOT EXISTS "PromoCodeRedemption_promoCodeId_createdAt_idx" ON "PromoCodeRedemption"("promoCodeId", "createdAt");
CREATE INDEX IF NOT EXISTS "PromoCodeRedemption_email_idx" ON "PromoCodeRedemption"("email");
CREATE INDEX IF NOT EXISTS "PromoCodeRedemption_userId_idx" ON "PromoCodeRedemption"("userId");
CREATE INDEX IF NOT EXISTS "PromoCodeRedemption_guestId_idx" ON "PromoCodeRedemption"("guestId");

DO $$ BEGIN
  ALTER TABLE "PromoCodeRedemption" ADD CONSTRAINT "PromoCodeRedemption_promoCodeId_fkey"
    FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PromoCodeRedemption" ADD CONSTRAINT "PromoCodeRedemption_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
