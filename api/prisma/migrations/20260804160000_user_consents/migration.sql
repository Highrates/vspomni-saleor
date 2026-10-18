-- AlterTable
ALTER TABLE "User" ADD COLUMN "privacyConsentAt" TIMESTAMP(3),
ADD COLUMN "privacyConsentVersion" TEXT,
ADD COLUMN "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "marketingConsentAt" TIMESTAMP(3),
ADD COLUMN "marketingConsentVersion" TEXT;
