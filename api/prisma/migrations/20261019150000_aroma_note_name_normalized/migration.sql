-- Case-insensitive uniqueness for aroma note definitions
ALTER TABLE "AromaNoteDefinition" ADD COLUMN IF NOT EXISTS "nameNormalized" TEXT;

UPDATE "AromaNoteDefinition"
SET "nameNormalized" = lower(trim("name"))
WHERE "nameNormalized" IS NULL OR "nameNormalized" = '';

-- Merge case-duplicates: keep earliest id, re-point product notes, drop extras
WITH ranked AS (
  SELECT
    id,
    "nameNormalized",
    ROW_NUMBER() OVER (PARTITION BY "nameNormalized" ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "AromaNoteDefinition"
),
keepers AS (
  SELECT id, "nameNormalized" FROM ranked WHERE rn = 1
),
dupes AS (
  SELECT r.id AS dupe_id, k.id AS keep_id
  FROM ranked r
  JOIN keepers k ON k."nameNormalized" = r."nameNormalized"
  WHERE r.rn > 1
)
UPDATE "ProductAromaNote" n
SET "definitionId" = d.keep_id
FROM dupes d
WHERE n."definitionId" = d.dupe_id
  AND NOT EXISTS (
    SELECT 1 FROM "ProductAromaNote" x
    WHERE x."productId" = n."productId"
      AND x."definitionId" = d.keep_id
      AND x."kind" = n."kind"
  );

-- Drop product notes that would violate unique after merge
DELETE FROM "ProductAromaNote" n
USING dupes d
WHERE n."definitionId" = d.dupe_id;

DELETE FROM "AromaNoteDefinition" a
USING dupes d
WHERE a.id = d.dupe_id;

DROP INDEX IF EXISTS "AromaNoteDefinition_name_key";

ALTER TABLE "AromaNoteDefinition" ALTER COLUMN "nameNormalized" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "AromaNoteDefinition_nameNormalized_key"
  ON "AromaNoteDefinition"("nameNormalized");
