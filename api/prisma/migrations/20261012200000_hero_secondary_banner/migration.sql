-- CreateTable
CREATE TABLE "HeroSecondaryBanner" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Аромат, что остаётся. История, что звучит в памяти',
    "subtitle" TEXT NOT NULL DEFAULT 'Каждый аромат — это история, сотканная из чувств, мгновений и памяти.',
    "imageUrl" TEXT NOT NULL DEFAULT '/images/hero-badge.png',
    "href" TEXT NOT NULL DEFAULT '/catalog/aroma/teplichka-u-babuli',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeroSecondaryBanner_pkey" PRIMARY KEY ("id")
);

-- Seed singleton
INSERT INTO "HeroSecondaryBanner" ("id", "title", "subtitle", "imageUrl", "href", "updatedAt")
VALUES (
  'default',
  'Аромат, что остаётся. История, что звучит в памяти',
  'Каждый аромат — это история, сотканная из чувств, мгновений и памяти.',
  '/images/hero-badge.png',
  '/catalog/aroma/teplichka-u-babuli',
  CURRENT_TIMESTAMP
);
