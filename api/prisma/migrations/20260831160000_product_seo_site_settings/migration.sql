-- Product SEO fields
ALTER TABLE "Product" ADD COLUMN "metaTitle" TEXT;
ALTER TABLE "Product" ADD COLUMN "metaDescription" VARCHAR(500);
ALTER TABLE "Product" ADD COLUMN "ogImageUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN "canonicalPath" TEXT;
ALTER TABLE "Product" ADD COLUMN "seoNoIndex" BOOLEAN NOT NULL DEFAULT false;

-- Site-wide SEO settings (singleton)
CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "siteUrl" TEXT,
    "titleSuffix" TEXT NOT NULL DEFAULT 'Miraflores',
    "defaultMetaDescription" TEXT,
    "defaultOgImageUrl" TEXT,
    "homeMetaTitle" TEXT,
    "homeMetaDescription" TEXT,
    "homeOgImageUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "SiteSettings" ("id", "titleSuffix", "updatedAt")
VALUES ('default', 'Miraflores', CURRENT_TIMESTAMP);
