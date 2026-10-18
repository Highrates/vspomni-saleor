-- Deduplicate buyer reviews (keep oldest) before unique(productId, userId)
DELETE FROM "ProductReview" AS a
USING "ProductReview" AS b
WHERE a."userId" IS NOT NULL
  AND a."userId" = b."userId"
  AND a."productId" = b."productId"
  AND a."id" <> b."id"
  AND (
    a."createdAt" > b."createdAt"
    OR (a."createdAt" = b."createdAt" AND a."id" > b."id")
  );

CREATE UNIQUE INDEX "ProductReview_productId_userId_key" ON "ProductReview"("productId", "userId");
