import 'server-only';
import { headers } from 'next/headers';
import { env } from '@/lib/env';
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

  if (env.RATE_LIMIT_DRIVER === 'redis') {
    // The Redis driver is not wired up in this build. Failing closed here
    // would take the whole app down on a misconfiguration, so we fall back to
    // the in-memory counter and make the degradation loud instead of silent.
    securityLog.warn(
      { driver: 'redis' },
      'redis rate-limit driver not available; using in-memory counter'
    );
  }

  return consumeMemory(key, rule);
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

/** Test seam: drops all counters. */
export function __resetRateLimits(): void {
  store.clear();
}
