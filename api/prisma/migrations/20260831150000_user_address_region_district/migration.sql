-- AlterTable
ALTER TABLE "UserAddress" ADD COLUMN IF NOT EXISTS "region" TEXT;
ALTER TABLE "UserAddress" ADD COLUMN IF NOT EXISTS "district" TEXT;
