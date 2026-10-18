-- AlterTable
ALTER TABLE "User" ADD COLUMN "staffDeletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "User_staffDeletedAt_idx" ON "User"("staffDeletedAt");
