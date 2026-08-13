-- AlterTable
ALTER TABLE "products" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "isFoundingCreator" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "descriptionMd" TEXT NOT NULL,
    "logoKey" TEXT,
    "website" TEXT,
    "location" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateIndex
CREATE INDEX "companies_featured_idx" ON "companies"("featured");

-- CreateIndex
CREATE INDEX "products_companyId_idx" ON "products"("companyId");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS deny-all on the new table. The grant side of the lockdown in
-- 20260812200000_lock_down_public_schema already covers tables created
-- later (it revokes anon/authenticated via ALTER DEFAULT PRIVILEGES), but
-- that migration's RLS-enable loop only ran once, over the tables that
-- existed at the time. A table created after it starts with RLS off and
-- needs this explicitly, or it is the one table relying on the grant layer
-- alone — see that migration's comment for why this is deliberately two
-- independent layers rather than one.
ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;
