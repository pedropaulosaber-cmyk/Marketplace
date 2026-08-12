import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';

/**
 * Low-level cryptographic helpers.
 *
 * The session secret never leaves this module; callers work with opaque
 * tokens and fingerprints.
 */

/** 256 bits of CSPRNG entropy, URL-safe. Used for session and download tokens. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * Keyed fingerprint of a token.
 *
 * Sessions are stored as HMACs rather than raw tokens so a database dump
 * cannot be replayed: without SESSION_SECRET the stored value is useless.
 * HMAC-SHA256 (not a slow KDF) is correct here — the input already has 256
 * bits of entropy, so brute force is infeasible and we need constant-time
 * lookup on every request.
 */
export function fingerprint(token: string): string {
  return createHmac('sha256', env.SESSION_SECRET).update(token).digest('hex');
}

/**
 * Pseudonymised IP, for rate limiting and audit trails.
 *
 * Storing a keyed hash rather than the address itself keeps the audit log
 * useful (same visitor is still correlatable) without retaining personal data
 * in the clear.
 */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHmac('sha256', env.SESSION_SECRET)
    .update(`ip:${ip}`)
    .digest('hex')
    .slice(0, 32);
}

/** Constant-time string comparison, safe against length-leaking timing attacks. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // Still burn a comparison so the failure path takes similar time.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
