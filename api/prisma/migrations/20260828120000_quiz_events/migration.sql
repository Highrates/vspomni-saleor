-- CreateTable
CREATE TABLE "QuizEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "zone" TEXT,
    "stepKey" TEXT,
    "userId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuizEvent_createdAt_idx" ON "QuizEvent"("createdAt");

-- CreateIndex
CREATE INDEX "QuizEvent_type_createdAt_idx" ON "QuizEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "QuizEvent_sessionId_createdAt_idx" ON "QuizEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "QuizEvent_zone_type_createdAt_idx" ON "QuizEvent"("zone", "type", "createdAt");
