-- CreateTable
CREATE TABLE "AromaNoteDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AromaNoteDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AromaNoteDefinition_name_key" ON "AromaNoteDefinition"("name");

-- Backfill definitions from existing product notes (case-insensitive name groups)
INSERT INTO "AromaNoteDefinition" ("id", "name", "imageUrl", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text AS id,
  g.display_name AS name,
  g.image_url AS "imageUrl",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT
    lower(trim(n."name")) AS canon_name,
    (array_agg(trim(n."name") ORDER BY n."createdAt" ASC))[1] AS display_name,
    (array_agg(n."imageUrl" ORDER BY CASE WHEN n."imageUrl" IS NULL OR n."imageUrl" = '' THEN 1 ELSE 0 END, n."createdAt" ASC))[1] AS image_url
  FROM "ProductAromaNote" n
  WHERE trim(n."name") <> ''
  GROUP BY lower(trim(n."name"))
) g;

-- Add nullable definitionId, then fill
ALTER TABLE "ProductAromaNote" ADD COLUMN "definitionId" TEXT;

UPDATE "ProductAromaNote" n
SET "definitionId" = d.id
FROM "AromaNoteDefinition" d
WHERE lower(trim(n."name")) = lower(d."name");

-- Drop any orphan notes that somehow have empty names (cannot link)
DELETE FROM "ProductAromaNote" WHERE "definitionId" IS NULL;

ALTER TABLE "ProductAromaNote" ALTER COLUMN "definitionId" SET NOT NULL;
ALTER TABLE "ProductAromaNote" DROP COLUMN "name";

CREATE INDEX "ProductAromaNote_definitionId_idx" ON "ProductAromaNote"("definitionId");

-- Deduplicate (productId, definitionId, kind) keeping earliest sortOrder/id
DELETE FROM "ProductAromaNote" a
USING "ProductAromaNote" b
WHERE a."productId" = b."productId"
  AND a."definitionId" = b."definitionId"
  AND a."kind" = b."kind"
  AND a."id" > b."id";

CREATE UNIQUE INDEX "ProductAromaNote_productId_definitionId_kind_key"
  ON "ProductAromaNote"("productId", "definitionId", "kind");

ALTER TABLE "ProductAromaNote"
  ADD CONSTRAINT "ProductAromaNote_definitionId_fkey"
  FOREIGN KEY ("definitionId") REFERENCES "AromaNoteDefinition"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
