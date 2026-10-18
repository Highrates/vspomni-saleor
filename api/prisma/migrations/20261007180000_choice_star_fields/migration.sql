-- «Выбор ⭐» metadata from Saleor attrs vybor-imya / vybor-data / vybor-foto
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "choiceStarName" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "choiceStarDate" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "choiceStarImageUrl" TEXT;
