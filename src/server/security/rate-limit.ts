import 'server-only';
import { headers } from 'next/headers';
import { db } from '@/server/db/client';
import { env, isDatabaseConfigured } from '@/lib/env';
import { hashIp } from './crypto';
import { rateLimited } from '@/lib/errors';
import { securityLog } from '@/lib/logger';

/**
 * Rate limiting.
 *
 * A fixed-window counter, keyed by action + identity (user id when signed in,
 * hashed IP otherwise). The in-memory driver is correct for a single instance;
 * `RATE_LIMIT_DRIVER=redis` is the multi-instance path and is wired through the
 * same interface so switching needs no call-site changes.
 *
 * This is one layer of several — it protects against brute force and scripted
 * abuse, not against a distributed attacker. Authorization is always enforced
 * independently.
 */

export interface RateLimitRule {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Maximum permitted requests inside one window. */
  max: number;
}

/**
 * Named limits. Login is deliberately strict; browsing is generous.
 */
export const LIMITS = {
  login: { windowMs: 15 * 60_000, max: 8 },
  register: { windowMs: 60 * 60_000, max: 5 },
  passwordReset: { windowMs: 60 * 60_000, max: 5 },
  checkout: { windowMs: 60_000, max: 10 },
  download: { windowMs: 60_000, max: 30 },
  upload: { windowMs: 60 * 60_000, max: 40 },
  review: { windowMs: 60 * 60_000, max: 10 },
  proposal: { windowMs: 60 * 60_000, max: 20 },
  demand: { windowMs: 60 * 60_000, max: 10 },
  message: { windowMs: 60_000, max: 30 },
  search: { windowMs: 60_000, max: 120 },
  mutation: { windowMs: 60_000, max: 60 },
} as const satisfies Record<string, RateLimitRule>;

export type LimitName = keyof typeof LIMITS;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

interface Counter {
  count: number;
  resetAt: number;
}

/**
 * In-process store. Entries are swept lazily on write so an idle key cannot
 * leak memory indefinitely.
 */
const store = new Map<string, Counter>();
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, counter] of store) {
    if (counter.resetAt <= now) store.delete(key);
  }
}

function consumeMemory(key: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + rule.windowMs;
    store.set(key, { count: 1, resetAt });
    return { ok: true, remaining: rule.max - 1, resetAt };
  }

  existing.count += 1;
  const remaining = Math.max(0, rule.max - existing.count);

  return {
    ok: existing.count <= rule.max,
    remaining,
    resetAt: existing.resetAt,
  };
}

/**
 * Shared counter, incremented in one statement.
 *
 * The whole window update is a single `INSERT ... ON CONFLICT DO UPDATE`, so
 * concurrent instances serialise on the row lock instead of racing a
 * read-modify-write. Doing it as a read followed by a write would let two
 * requests both observe `count = max - 1` and both be allowed.
 *
 * The expiry check lives inside the statement as well: a window whose
 * `resetAt` has passed is reset to 1 rather than incremented, which is what
 * makes this a fixed window without needing a separate cleanup pass to be
 * correct.
 */
async function consumeDatabase(
  key: string,
  rule: RateLimitRule
): Promise<RateLimitResult> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + rule.windowMs);

  const rows = await db.$queryRaw<Array<{ count: number; resetAt: Date }>>`
    INSERT INTO rate_limit_counters ("key", "count", "resetAt")
    VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN rate_limit_counters."resetAt" <= ${now} THEN 1
        ELSE rate_limit_counters."count" + 1
      END,
      "resetAt" = CASE
        WHEN rate_limit_counters."resetAt" <= ${now} THEN ${resetAt}
        ELSE rate_limit_counters."resetAt"
      END
    RETURNING "count", "resetAt"
  `;

  const row = rows[0];
  if (!row) throw new Error('rate limit upsert returned no row');

  return {
    ok: row.count <= rule.max,
    remaining: Math.max(0, rule.max - row.count),
    resetAt: row.resetAt.getTime(),
  };
}

/**
 * Drops expired windows, occasionally.
 *
 * Rows are only ever read by primary key, so an expired row costs nothing to
 * leave behind — this exists to stop the table growing without bound, not for
 * correctness. Running it on a small fraction of calls keeps it off the hot
 * path without needing a scheduler.
 */
async function sweepDatabase(): Promise<void> {
  if (Math.random() > 0.01) return;

  try {
    await db.rateLimitCounter.deleteMany({
      where: { resetAt: { lt: new Date(Date.now() - 60_000) } },
    });
  } catch {
    // Housekeeping only — a failed sweep must never affect the request.
  }
}

/** Identity for the limiter: the signed-in user, else the calling IP. */
async function identity(userId?: string | null): Promise<string> {
  if (userId) return `u:${userId}`;

  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() ?? h.get('x-real-ip');
  return `ip:${hashIp(ip) ?? 'unknown'}`;
}

/**
 * Records one attempt against a named limit.
 *
 * Returns the result instead of throwing, for callers that want to degrade
 * gracefully. Most call sites want `enforceRateLimit`.
 */
export async function checkRateLimit(
  name: LimitName,
  userId?: string | null
): Promise<RateLimitResult> {
  const rule = LIMITS[name];
  const key = `${name}:${await identity(userId)}`;

  if (env.RATE_LIMIT_DRIVER === 'memory') return consumeMemory(key, rule);

  if (env.RATE_LIMIT_DRIVER === 'redis') {
    // The Redis driver is not wired up in this build. Falling back to the
    // shared database counter keeps the limit real across instances, which
    // the in-memory counter would not.
    securityLog.warn(
      { driver: 'redis' },
      'redis rate-limit driver not available; using database counter'
    );
  }

  // Without a database there is nothing shared to count in.
  if (!isDatabaseConfigured) return consumeMemory(key, rule);

  try {
    const result = await consumeDatabase(key, rule);
    void sweepDatabase();
    return result;
  } catch (error) {
    // Fail open, loudly.
    //
    // Every action behind this limiter needs the same database to do anything
    // meaningful — a login cannot verify a password, a checkout cannot read a
    // price. So when the counter is unreachable the operation it guards is
    // already failing, and refusing the request instead would convert a
    // database blip into a total outage without denying an attacker anything
    // they could have achieved anyway.
    securityLog.error(
      { err: error, limit: name },
      'rate limit store unavailable; allowing request'
    );
    return { ok: true, remaining: 0, resetAt: Date.now() + rule.windowMs };
  }
}

/** Records an attempt and throws `RATE_LIMITED` once the limit is exceeded. */
export async function enforceRateLimit(
  name: LimitName,
  userId?: string | null
): Promise<void> {
  const result = await checkRateLimit(name, userId);

  if (!result.ok) {
    securityLog.warn({ limit: name, userId }, 'rate limit exceeded');
    throw rateLimited();
  }
}

/**
 * Test seam: drops all counters, in both stores.
 *
 * Clearing only the in-process map would leave the database counters standing,
 * and tests would start bleeding rate-limit state into each other the moment
 * the default driver changed — which is exactly what happened.
 */
export async function __resetRateLimits(): Promise<void> {
  store.clear();

  if (!isDatabaseConfigured) return;

  try {
    await db.rateLimitCounter.deleteMany({});
  } catch {
    // A test database that is not reachable will fail the test itself.
  }
}
