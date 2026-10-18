-- CreateTable
CREATE TABLE "CatalogTagImage" (
    "id" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogTagImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogTagStep" (
    "id" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogTagStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CatalogTagImage_tagId_sortOrder_idx" ON "CatalogTagImage"("tagId", "sortOrder");

-- CreateIndex
CREATE INDEX "CatalogTagStep_tagId_sortOrder_idx" ON "CatalogTagStep"("tagId", "sortOrder");

-- AddForeignKey
ALTER TABLE "CatalogTagImage" ADD CONSTRAINT "CatalogTagImage_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "CatalogTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogTagStep" ADD CONSTRAINT "CatalogTagStep_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "CatalogTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
