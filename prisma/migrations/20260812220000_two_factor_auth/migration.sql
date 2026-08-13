-- Two-factor authentication.
--
-- A password is a single shared secret that can be phished, reused from
-- another breach, or read from a leaked database. Everything else in this
-- codebase assumes the password holds; this is the layer that survives it not
-- holding.

ALTER TABLE "users" ADD COLUMN "totpSecret" TEXT;
ALTER TABLE "users" ADD COLUMN "totpEnabledAt" TIMESTAMP(3);

-- --------------------------------------------------------------------------
-- Recovery codes
-- --------------------------------------------------------------------------

CREATE TABLE "recovery_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "recovery_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recovery_codes_codeHash_key" ON "recovery_codes"("codeHash");
CREATE INDEX "recovery_codes_userId_usedAt_idx" ON "recovery_codes"("userId", "usedAt");

ALTER TABLE "recovery_codes"
  ADD CONSTRAINT "recovery_codes_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- --------------------------------------------------------------------------
-- Pending second-factor challenges
-- --------------------------------------------------------------------------

CREATE TABLE "two_factor_challenges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "two_factor_challenges_pkey" PRIMARY KEY ("id")
);

-- Uniqueness on the fingerprint is what makes a challenge consumable exactly
-- once rather than replayable.
CREATE UNIQUE INDEX "two_factor_challenges_tokenHash_key" ON "two_factor_challenges"("tokenHash");
CREATE INDEX "two_factor_challenges_userId_idx" ON "two_factor_challenges"("userId");
CREATE INDEX "two_factor_challenges_expiresAt_idx" ON "two_factor_challenges"("expiresAt");

ALTER TABLE "two_factor_challenges"
  ADD CONSTRAINT "two_factor_challenges_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "two_factor_challenges"
  ADD CONSTRAINT "two_factor_challenges_attempts_non_negative"
  CHECK ("attempts" >= 0);

-- --------------------------------------------------------------------------
-- Same lockdown as the rest of the schema
-- --------------------------------------------------------------------------

ALTER TABLE "recovery_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "two_factor_challenges" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  role_name text;
  table_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      FOREACH table_name IN ARRAY ARRAY['recovery_codes', 'two_factor_challenges'] LOOP
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', table_name, role_name);
      END LOOP;
    END IF;
  END LOOP;
END $$;
