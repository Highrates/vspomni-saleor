-- CreateTable
CREATE TABLE "UserFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserFavorite_userId_createdAt_idx" ON "UserFavorite"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserFavorite_userId_variantId_key" ON "UserFavorite"("userId", "variantId");

-- AddForeignKey
ALTER TABLE "UserFavorite" ADD CONSTRAINT "UserFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFavorite" ADD CONSTRAINT "UserFavorite_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS (покупатель — только свои строки)
ALTER TABLE "UserFavorite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserFavorite" FORCE ROW LEVEL SECURITY;

CREATE POLICY user_favorite_all ON "UserFavorite"
  FOR ALL
  USING (jcos_rls_bypass() OR "userId" = jcos_rls_user_id())
  WITH CHECK (jcos_rls_bypass() OR "userId" = jcos_rls_user_id());
