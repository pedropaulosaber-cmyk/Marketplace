import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LIMITS,
  __resetRateLimits,
  checkRateLimit,
} from '@/server/security/rate-limit';
import { db } from '@/server/db/client';
import { resetDatabase } from './helpers';

/**
 * The property that matters here is durability, not arithmetic.
 *
 * An in-process counter passes a naive "does it count to N" test perfectly
 * while being nearly useless in production: on serverless each request can
 * land on a cold instance with an empty map, so an attacker gets an unbounded
 * supply of first attempts. These tests assert the counter survives the thing
 * that actually breaks it — the process losing its memory.
 */

describe('rate limiting', () => {
  beforeEach(async () => {
    await resetDatabase();
    await __resetRateLimits();
  });

  it('counts down to the configured maximum and then refuses', async () => {
    const max = LIMITS.login.max;

    for (let attempt = 1; attempt <= max; attempt += 1) {
      const result = await checkRateLimit('login', 'user-under-limit');
      expect(result.ok).toBe(true);
      expect(result.remaining).toBe(max - attempt);
    }

    const exceeded = await checkRateLimit('login', 'user-under-limit');
    expect(exceeded.ok).toBe(false);
    expect(exceeded.remaining).toBe(0);
  });

  it('survives the process losing its in-memory state', async () => {
    const max = LIMITS.login.max;

    for (let attempt = 0; attempt < max; attempt += 1) {
      await checkRateLimit('login', 'user-cold-start');
    }

    // A real cold start: resetting the module registry hands back a fresh
    // copy of the limiter with an empty in-process map, exactly as a new
    // serverless instance would arrive. An in-memory limiter grants a full
    // new window here — which is the failure this whole driver exists to fix.
    vi.resetModules();
    const coldInstance = await import('@/server/security/rate-limit');

    const afterRestart = await coldInstance.checkRateLimit(
      'login',
      'user-cold-start'
    );

    expect(afterRestart.ok).toBe(false);
  });

  it('keeps separate identities in separate windows', async () => {
    for (let attempt = 0; attempt < LIMITS.login.max; attempt += 1) {
      await checkRateLimit('login', 'noisy-neighbour');
    }

    // One account being brute-forced must not lock everyone else out.
    const other = await checkRateLimit('login', 'unrelated-user');
    expect(other.ok).toBe(true);
  });

  it('keeps separate limits from sharing a counter', async () => {
    for (let attempt = 0; attempt < LIMITS.login.max; attempt += 1) {
      await checkRateLimit('login', 'same-person');
    }

    const checkout = await checkRateLimit('checkout', 'same-person');
    expect(checkout.ok).toBe(true);
  });

  it('persists the counter where every instance can see it', async () => {
    await checkRateLimit('login', 'shared-visibility');

    const rows = await db.rateLimitCounter.findMany({
      where: { key: { startsWith: 'login:' } },
    });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.count).toBeGreaterThan(0);
  });
});
