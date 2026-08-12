-- ---------------------------------------------------------------------------
-- Integrity constraints that the Prisma schema language cannot express.
--
-- These are a second line of defence: application code validates the same
-- rules with Zod, but the database is the last authority. A bug in a service,
-- a bad migration or a manual query cannot corrupt these invariants.
-- ---------------------------------------------------------------------------

-- Reviews are 1-5 stars.
ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_rating_range"
  CHECK ("rating" >= 1 AND "rating" <= 5);

-- A favorite points at exactly one target: a product or a professional.
ALTER TABLE "favorites"
  ADD CONSTRAINT "favorites_exactly_one_target"
  CHECK (num_nonnulls("productId", "professionalId") = 1);

-- Money is never negative anywhere in the ledger.
ALTER TABLE "products"
  ADD CONSTRAINT "products_price_non_negative" CHECK ("priceCents" >= 0);

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_amounts_non_negative"
  CHECK ("subtotalCents" >= 0 AND "feeCents" >= 0 AND "totalCents" >= 0);

-- The order total must equal what the buyer is actually charged. The fee is
-- the platform's cut *of* the subtotal, not an addition to it.
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_total_matches_subtotal"
  CHECK ("totalCents" = "subtotalCents");

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_amounts_valid"
  CHECK (
    "unitCents" >= 0
    AND "quantity" > 0
    AND "feeCents" >= 0
    AND "sellerCents" >= 0
    AND "feeCents" + "sellerCents" = "unitCents" * "quantity"
  );

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_non_negative" CHECK ("amountCents" >= 0);

ALTER TABLE "payouts"
  ADD CONSTRAINT "payouts_amount_non_negative" CHECK ("amountCents" >= 0);

-- Ranges must be ordered.
ALTER TABLE "demands"
  ADD CONSTRAINT "demands_budget_range_valid"
  CHECK ("budgetMinCents" >= 0 AND "budgetMaxCents" >= "budgetMinCents");

ALTER TABLE "professional_profiles"
  ADD CONSTRAINT "professional_rate_range_valid"
  CHECK ("rateMinCents" >= 0 AND "rateMaxCents" >= "rateMinCents");

ALTER TABLE "proposals"
  ADD CONSTRAINT "proposals_valid"
  CHECK ("priceCents" >= 0 AND "deliveryWeeks" > 0);

ALTER TABLE "demands"
  ADD CONSTRAINT "demands_deadline_positive" CHECK ("deadlineWeeks" > 0);

-- Aggregate counters can never go negative.
ALTER TABLE "products"
  ADD CONSTRAINT "products_counters_non_negative"
  CHECK ("ratingSum" >= 0 AND "ratingCount" >= 0 AND "salesCount" >= 0);

-- A message must have content.
ALTER TABLE "messages"
  ADD CONSTRAINT "messages_body_not_blank" CHECK (length(btrim("body")) > 0);

-- Case-insensitive uniqueness for email: "A@x.com" and "a@x.com" are the same
-- account. The application lowercases on write; this enforces it regardless.
CREATE UNIQUE INDEX "users_email_lower_key" ON "users" (lower("email"));

-- Full-text search support for the product catalog. A GIN index over the
-- searchable text keeps catalog search fast as the catalog grows.
CREATE INDEX "products_search_idx" ON "products"
  USING GIN (to_tsvector('portuguese',
    "name" || ' ' || "tagline" || ' ' || coalesce("descriptionMd", '')));

-- Partial index for the public catalog: the overwhelmingly common query only
-- ever looks at published, non-deleted rows.
CREATE INDEX "products_public_idx" ON "products" ("publishedAt" DESC)
  WHERE "status" = 'PUBLISHED' AND "deletedAt" IS NULL;
