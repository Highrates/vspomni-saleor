-- CreateTable
CREATE TABLE IF NOT EXISTS "RegistrationCompletion" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "consentPersonalData" BOOLEAN NOT NULL,
    "consentMarketing" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RegistrationCompletion_email_idx" ON "RegistrationCompletion"("email");
CREATE INDEX IF NOT EXISTS "RegistrationCompletion_expiresAt_idx" ON "RegistrationCompletion"("expiresAt");
CREATE INDEX IF NOT EXISTS "RegistrationChallenge_expiresAt_idx" ON "RegistrationChallenge"("expiresAt");

CREATE TABLE IF NOT EXISTS "RegistrationOtpDispatch" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RegistrationOtpDispatch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RegistrationOtpDispatch_email_createdAt_idx"
  ON "RegistrationOtpDispatch"("email", "createdAt");
