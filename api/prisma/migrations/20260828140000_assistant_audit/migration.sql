-- CreateTable
CREATE TABLE "AssistantAuditEvent" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "threadId" TEXT,
    "kind" TEXT NOT NULL,
    "toolName" TEXT,
    "promptChars" INTEGER,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "model" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssistantAuditEvent_staffId_createdAt_idx" ON "AssistantAuditEvent"("staffId", "createdAt");

-- CreateIndex
CREATE INDEX "AssistantAuditEvent_createdAt_idx" ON "AssistantAuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AssistantAuditEvent_kind_createdAt_idx" ON "AssistantAuditEvent"("kind", "createdAt");
