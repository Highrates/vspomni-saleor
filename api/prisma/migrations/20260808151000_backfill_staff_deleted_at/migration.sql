-- Backfill soft-deleted staff from email sentinel (idempotent)
UPDATE "User"
SET "staffDeletedAt" = COALESCE("updatedAt", NOW())
WHERE "email" LIKE 'staff-deleted-%' AND "staffDeletedAt" IS NULL;
