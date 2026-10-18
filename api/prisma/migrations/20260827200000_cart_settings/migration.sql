-- Rename DeliverySettings → CartSettings and add legalHtml
ALTER TABLE "DeliverySettings" RENAME TO "CartSettings";

ALTER TABLE "CartSettings"
  ADD COLUMN "legalHtml" TEXT NOT NULL DEFAULT '<p></p>';
