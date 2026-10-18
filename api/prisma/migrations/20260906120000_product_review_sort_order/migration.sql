-- AlterTable
ALTER TABLE "ProductReview" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Backfill: current public order was createdAt DESC → assign 0..n
WITH ranked AS (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY "createdAt" DESC, id ASC) - 1)::int AS rn
  FROM "ProductReview"
)
UPDATE "ProductReview" AS pr
SET "sortOrder" = ranked.rn
FROM ranked
WHERE pr.id = ranked.id;

-- CreateIndex
CREATE INDEX "ProductReview_isPublished_sortOrder_idx" ON "ProductReview"("isPublished", "sortOrder");
