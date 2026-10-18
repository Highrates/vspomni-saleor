-- CreateEnum
CREATE TYPE "GiftCertificateStatus" AS ENUM ('ACTIVE', 'USED_UP', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "GiftCertificateLedgerKind" AS ENUM ('ISSUE', 'CAPTURE', 'RELEASE', 'ADJUST', 'REVOKE');

-- CreateEnum
CREATE TYPE "GiftCertificateSource" AS ENUM ('ADMIN', 'PURCHASE');

-- CreateTable
CREATE TABLE "GiftCertificateDenomination" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "faceValue" INTEGER NOT NULL,
    "validityDays" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftCertificateDenomination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCertificate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "denominationId" TEXT,
    "faceValue" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "status" "GiftCertificateStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" "GiftCertificateSource" NOT NULL DEFAULT 'ADMIN',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "recipientEmail" TEXT,
    "recipientUserId" TEXT,
    "issuedByUserId" TEXT,
    "note" TEXT,
    "purchaseOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCertificateLedger" (
    "id" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "kind" "GiftCertificateLedgerKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "orderId" TEXT,
    "actorUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftCertificateLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GiftCertificateDenomination_active_sortOrder_idx" ON "GiftCertificateDenomination"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "GiftCertificateDenomination_faceValue_idx" ON "GiftCertificateDenomination"("faceValue");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCertificate_code_key" ON "GiftCertificate"("code");

-- CreateIndex
CREATE INDEX "GiftCertificate_status_createdAt_idx" ON "GiftCertificate"("status", "createdAt");

-- CreateIndex
CREATE INDEX "GiftCertificate_recipientEmail_idx" ON "GiftCertificate"("recipientEmail");

-- CreateIndex
CREATE INDEX "GiftCertificate_recipientUserId_idx" ON "GiftCertificate"("recipientUserId");

-- CreateIndex
CREATE INDEX "GiftCertificate_expiresAt_idx" ON "GiftCertificate"("expiresAt");

-- CreateIndex
CREATE INDEX "GiftCertificate_denominationId_idx" ON "GiftCertificate"("denominationId");

-- CreateIndex
CREATE INDEX "GiftCertificateLedger_certificateId_createdAt_idx" ON "GiftCertificateLedger"("certificateId", "createdAt");

-- CreateIndex
CREATE INDEX "GiftCertificateLedger_orderId_idx" ON "GiftCertificateLedger"("orderId");

-- AddForeignKey
ALTER TABLE "GiftCertificate" ADD CONSTRAINT "GiftCertificate_denominationId_fkey" FOREIGN KEY ("denominationId") REFERENCES "GiftCertificateDenomination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCertificate" ADD CONSTRAINT "GiftCertificate_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCertificateLedger" ADD CONSTRAINT "GiftCertificateLedger_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "GiftCertificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
