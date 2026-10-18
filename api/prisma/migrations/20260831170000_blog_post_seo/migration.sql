-- BlogPost SEO fields (mirrors Product SEO)
ALTER TABLE "BlogPost" ADD COLUMN "metaTitle" TEXT;
ALTER TABLE "BlogPost" ADD COLUMN "metaDescription" VARCHAR(500);
ALTER TABLE "BlogPost" ADD COLUMN "ogImageUrl" TEXT;
ALTER TABLE "BlogPost" ADD COLUMN "canonicalPath" TEXT;
ALTER TABLE "BlogPost" ADD COLUMN "seoNoIndex" BOOLEAN NOT NULL DEFAULT false;
