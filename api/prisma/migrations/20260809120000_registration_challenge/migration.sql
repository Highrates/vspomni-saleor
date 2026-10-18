-- CreateTable
CREATE TABLE "RegistrationChallenge" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consentPersonalData" BOOLEAN NOT NULL,
    "consentMarketing" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegistrationChallenge_email_idx" ON "RegistrationChallenge"("email");
