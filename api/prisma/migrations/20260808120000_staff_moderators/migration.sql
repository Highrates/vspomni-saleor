-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'MODERATOR';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "staffDisplayName" TEXT;
ALTER TABLE "User" ADD COLUMN "staffAvatarUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "adminSections" TEXT[] DEFAULT ARRAY[]::TEXT[];
