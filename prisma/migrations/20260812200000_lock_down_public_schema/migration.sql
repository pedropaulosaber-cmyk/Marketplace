-- Close the PostgREST/anon path to the database.
--
-- This application reaches Postgres only through Prisma on a direct
-- connection. On Supabase that authenticates as `postgres`, a role carrying
-- BYPASSRLS, so nothing here affects the application's own access. What it
-- does close is the Supabase client-library path: with the publishable
-- ("anon") key, PostgREST talks to the database as the `anon` role, and by
-- default that role can read and write every table. Since no part of this
-- codebase uses the Supabase client libraries, that path should grant
-- precisely nothing — a leaked publishable key then buys an attacker no data.
--
-- Two independent layers, because either alone has a failure mode:
--   1. Deny-all RLS — row security enabled with zero policies, so every row
--      is invisible to any role without BYPASSRLS.
--   2. Revoked grants — the role cannot reach the table for RLS to even be
--      evaluated, which also covers a table created later by someone who
--      forgets step 1.
--
-- Deliberately no FORCE ROW LEVEL SECURITY. The threat being closed is a
-- leaked publishable key, not the application's own role; forcing RLS onto
-- the owner would risk locking the application out for no gain against that
-- threat.
--
-- The role grants are guarded because `anon` and `authenticated` are Supabase
-- roles: they do not exist on a local Postgres or in CI, and this migration
-- has to apply cleanly there too.

-- 1. Deny-all RLS on every table in the schema.
DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target.tablename);
  END LOOP;
END $$;

-- 2. Strip every privilege those roles hold, now and in future.
DO $$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', role_name);
      EXECUTE format('REVOKE USAGE ON SCHEMA public FROM %I', role_name);

      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I',
        role_name
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I',
        role_name
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I',
        role_name
      );
    END IF;
  END LOOP;
END $$;
