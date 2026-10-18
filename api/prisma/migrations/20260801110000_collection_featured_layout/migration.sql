-- AlterTable
ALTER TABLE "Collection" ADD COLUMN IF NOT EXISTS "featuredLayout" BOOLEAN NOT NULL DEFAULT false;
