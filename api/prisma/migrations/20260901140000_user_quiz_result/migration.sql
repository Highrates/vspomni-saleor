-- CreateTable
CREATE TABLE "UserQuizResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "zone" TEXT NOT NULL DEFAULT 'face',
    "answers" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserQuizResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserQuizResult_userId_key" ON "UserQuizResult"("userId");

-- CreateIndex
CREATE INDEX "UserQuizResult_completedAt_idx" ON "UserQuizResult"("completedAt");

-- AddForeignKey
ALTER TABLE "UserQuizResult" ADD CONSTRAINT "UserQuizResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS (покупатель — только свои строки)
ALTER TABLE "UserQuizResult" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserQuizResult" FORCE ROW LEVEL SECURITY;

CREATE POLICY user_quiz_result_all ON "UserQuizResult"
  FOR ALL
  USING (jcos_rls_bypass() OR "userId" = jcos_rls_user_id())
  WITH CHECK (jcos_rls_bypass() OR "userId" = jcos_rls_user_id());
