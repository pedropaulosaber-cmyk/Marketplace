-- Durable rate-limit counters.
--
-- The in-process counter this replaces is correct only for a single
-- long-lived instance. On serverless it is close to useless: each request can
-- land on a cold instance with an empty map, so an attacker receives an
-- effectively unlimited supply of "first attempts" and the limiter enforces
-- almost nothing while still appearing to work.
--
-- A table gives every instance one shared counter. The increment is a single
-- INSERT ... ON CONFLICT statement, so concurrent instances serialise on the
-- row lock rather than racing a read-modify-write.

CREATE TABLE "rate_limit_counters" (
    -- "<limit name>:<identity>", where identity is a user id or hashed IP.
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_counters_pkey" PRIMARY KEY ("key")
);

-- Supports the opportunistic sweep of expired windows.
CREATE INDEX "rate_limit_counters_resetAt_idx" ON "rate_limit_counters"("resetAt");

ALTER TABLE "rate_limit_counters"
  ADD CONSTRAINT "rate_limit_counters_count_non_negative"
  CHECK ("count" >= 0);

-- Same lockdown the rest of the schema carries: nothing reaches this table
-- except the application's own connection.
ALTER TABLE "rate_limit_counters" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'REVOKE ALL ON TABLE public.rate_limit_counters FROM %I',
        role_name
      );
    END IF;
  END LOOP;
END $$;
