-- Affiliate programme.
--
-- Per-product programmes, one affiliate row per person per programme, and a
-- commission ledger keyed to the order item so a sale can be settled exactly
-- once. Attribution is frozen onto the order item at checkout, so revoking an
-- affiliate later never rewrites money already owed.

CREATE TYPE "AffiliateStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'BLOCKED');
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'REVERSED');

-- --------------------------------------------------------------------------
-- Programmes
-- --------------------------------------------------------------------------

CREATE TABLE "affiliate_programs" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "commissionBps" INTEGER NOT NULL DEFAULT 2000,
    "cookieDays" INTEGER NOT NULL DEFAULT 30,
    "autoApprove" BOOLEAN NOT NULL DEFAULT true,
    "terms" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_programs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "affiliate_programs_productId_key" ON "affiliate_programs"("productId");
CREATE INDEX "affiliate_programs_ownerId_idx" ON "affiliate_programs"("ownerId");
CREATE INDEX "affiliate_programs_enabled_idx" ON "affiliate_programs"("enabled");

ALTER TABLE "affiliate_programs"
  ADD CONSTRAINT "affiliate_programs_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "affiliate_programs"
  ADD CONSTRAINT "affiliate_programs_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The platform fee is 15%, so a commission above 80% could not be paid out of
-- the seller's share. The ceiling is enforced here as well as in Zod: the
-- database is the last place a bad rate can be stopped before it becomes money.
ALTER TABLE "affiliate_programs"
  ADD CONSTRAINT "affiliate_programs_commission_range"
  CHECK ("commissionBps" >= 0 AND "commissionBps" <= 8000);

ALTER TABLE "affiliate_programs"
  ADD CONSTRAINT "affiliate_programs_cookie_range"
  CHECK ("cookieDays" >= 1 AND "cookieDays" <= 365);

-- --------------------------------------------------------------------------
-- Affiliates
-- --------------------------------------------------------------------------

CREATE TABLE "affiliates" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "AffiliateStatus" NOT NULL DEFAULT 'PENDING',
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "conversionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "affiliates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "affiliates_code_key" ON "affiliates"("code");
CREATE UNIQUE INDEX "affiliates_programId_userId_key" ON "affiliates"("programId", "userId");
CREATE INDEX "affiliates_userId_status_idx" ON "affiliates"("userId", "status");
CREATE INDEX "affiliates_programId_status_idx" ON "affiliates"("programId", "status");

ALTER TABLE "affiliates"
  ADD CONSTRAINT "affiliates_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "affiliate_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "affiliates"
  ADD CONSTRAINT "affiliates_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "affiliates"
  ADD CONSTRAINT "affiliates_counters_non_negative"
  CHECK ("clickCount" >= 0 AND "conversionCount" >= 0);

-- --------------------------------------------------------------------------
-- Attribution on the order line
-- --------------------------------------------------------------------------

ALTER TABLE "order_items" ADD COLUMN "affiliateId" TEXT;
ALTER TABLE "order_items" ADD COLUMN "affiliateCents" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "order_items_affiliateId_idx" ON "order_items"("affiliateId");

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_affiliateId_fkey"
  FOREIGN KEY ("affiliateId") REFERENCES "affiliates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_affiliate_cents_non_negative"
  CHECK ("affiliateCents" >= 0);

-- The three shares must never exceed what the buyer actually paid.
ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_split_within_total"
  CHECK ("feeCents" + "sellerCents" + "affiliateCents" <= "unitCents" * "quantity");

-- --------------------------------------------------------------------------
-- Commission ledger
-- --------------------------------------------------------------------------

CREATE TABLE "affiliate_commissions" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "availableAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "affiliate_commissions_pkey" PRIMARY KEY ("id")
);

-- One commission per order line: the uniqueness constraint is what makes
-- settlement idempotent under webhook replay.
CREATE UNIQUE INDEX "affiliate_commissions_orderItemId_key" ON "affiliate_commissions"("orderItemId");
CREATE INDEX "affiliate_commissions_affiliateId_status_idx" ON "affiliate_commissions"("affiliateId", "status");
CREATE INDEX "affiliate_commissions_status_availableAt_idx" ON "affiliate_commissions"("status", "availableAt");

ALTER TABLE "affiliate_commissions"
  ADD CONSTRAINT "affiliate_commissions_affiliateId_fkey"
  FOREIGN KEY ("affiliateId") REFERENCES "affiliates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "affiliate_commissions"
  ADD CONSTRAINT "affiliate_commissions_orderItemId_fkey"
  FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "affiliate_commissions"
  ADD CONSTRAINT "affiliate_commissions_amount_non_negative"
  CHECK ("amountCents" >= 0);
