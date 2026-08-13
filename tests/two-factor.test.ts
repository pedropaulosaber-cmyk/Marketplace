import { beforeEach, describe, expect, it } from 'vitest';
import {
  base32Decode,
  base32Encode,
  generateTotp,
  generateTotpSecret,
  verifyTotp,
} from '@/server/security/totp';
import { open, seal } from '@/server/security/encryption';
import { login } from '@/server/services/auth-service';
import { completeChallenge } from '@/server/services/two-factor-service';
import { getSession } from '@/server/auth/session';
import { TEST_PASSWORD, createUser, db, resetDatabase } from './helpers';

/**
 * The TOTP implementation is checked against RFC 6238's published test
 * vectors, not just against itself. A self-consistent implementation that
 * disagrees with the spec would pass a round-trip test perfectly and then
 * reject every code a real authenticator app produces.
 */

// RFC 6238 Appendix B, SHA-1: the secret is the ASCII "12345678901234567890".
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890', 'ascii'));

describe('TOTP', () => {
  it('matches the RFC 6238 published test vectors', () => {
    const vectors: Array<[number, string]> = [
      [59, '287082'],
      [1111111109, '081804'],
      [1111111111, '050471'],
      [1234567890, '005924'],
      [2000000000, '279037'],
    ];

    for (const [seconds, expected] of vectors) {
      expect(generateTotp(RFC_SECRET, new Date(seconds * 1000))).toBe(expected);
    }
  });

  it('accepts the current code', () => {
    const secret = generateTotpSecret();
    const now = new Date();
    expect(verifyTotp(secret, generateTotp(secret, now), now)).toBe(true);
  });

  it('tolerates one step of clock drift in each direction', () => {
    const secret = generateTotpSecret();
    const now = new Date();

    const past = new Date(now.getTime() - 30_000);
    const future = new Date(now.getTime() + 30_000);

    expect(verifyTotp(secret, generateTotp(secret, past), now)).toBe(true);
    expect(verifyTotp(secret, generateTotp(secret, future), now)).toBe(true);
  });

  it('rejects a code from outside the drift window', () => {
    const secret = generateTotpSecret();
    const now = new Date();

    // Two steps out. Widening the window trades directly against brute force,
    // so this boundary is deliberate and worth pinning.
    const stale = new Date(now.getTime() - 90_000);
    expect(verifyTotp(secret, generateTotp(secret, stale), now)).toBe(false);
  });

  it('rejects a code generated from a different secret', () => {
    const now = new Date();
    const code = generateTotp(generateTotpSecret(), now);
    expect(verifyTotp(generateTotpSecret(), code, now)).toBe(false);
  });

  it('rejects malformed input rather than throwing', () => {
    const secret = generateTotpSecret();

    for (const bad of ['', 'abcdef', '12345', '1234567', '12 34 56 78']) {
      expect(verifyTotp(secret, bad)).toBe(false);
    }
  });

  it('round-trips base32 through the alphabet apps expect', () => {
    const original = Buffer.from('12345678901234567890', 'ascii');
    expect(base32Decode(base32Encode(original)).equals(original)).toBe(true);
    expect(base32Encode(original)).toMatch(/^[A-Z2-7]+$/);
  });
});

describe('secret encryption at rest', () => {
  it('round-trips a secret', () => {
    const secret = generateTotpSecret();
    expect(open(seal(secret))).toBe(secret);
  });

  it('never produces the same ciphertext twice for the same input', () => {
    const secret = generateTotpSecret();
    // A deterministic ciphertext would let anyone with the database tell which
    // accounts share a secret, and would leak that a secret was unchanged.
    expect(seal(secret)).not.toBe(seal(secret));
  });

  it('refuses a tampered ciphertext instead of returning wrong plaintext', () => {
    const sealed = seal(generateTotpSecret());
    const raw = Buffer.from(sealed, 'base64');

    // Flip a bit in the ciphertext body. GCM authenticates, so this must fail
    // rather than decrypt to something different.
    const last = raw.length - 1;
    raw[last] = (raw[last] ?? 0) ^ 0x01;

    expect(open(raw.toString('base64'))).toBeNull();
  });

  it('returns null for values that are not ciphertext at all', () => {
    for (const bad of ['', 'not-base64!', Buffer.alloc(4).toString('base64')]) {
      expect(open(bad)).toBeNull();
    }
  });
});

describe('login with a second factor', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('issues a challenge instead of a session when 2FA is on', async () => {
    const user = await createUser();
    const secret = generateTotpSecret();

    await db.user.update({
      where: { id: user.id },
      data: { totpSecret: seal(secret), totpEnabledAt: new Date() },
    });

    const result = await login({ email: user.email, password: TEST_PASSWORD });

    expect(result.requiresTwoFactor).toBe(true);

    // The point of the whole feature: a correct password has produced no
    // session. An attacker with stolen credentials is stopped here.
    expect(await getSession()).toBeNull();
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it('creates the session only after a valid code', async () => {
    const user = await createUser();
    const secret = generateTotpSecret();

    await db.user.update({
      where: { id: user.id },
      data: { totpSecret: seal(secret), totpEnabledAt: new Date() },
    });

    await login({ email: user.email, password: TEST_PASSWORD });
    await completeChallenge(generateTotp(secret));

    const session = await getSession();
    expect(session?.id).toBe(user.id);
  });

  it('refuses a wrong code and still creates no session', async () => {
    const user = await createUser();
    const secret = generateTotpSecret();

    await db.user.update({
      where: { id: user.id },
      data: { totpSecret: seal(secret), totpEnabledAt: new Date() },
    });

    await login({ email: user.email, password: TEST_PASSWORD });

    await expect(completeChallenge('000000')).rejects.toThrow();
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it('cannot replay one challenge into two sessions', async () => {
    const user = await createUser();
    const secret = generateTotpSecret();

    await db.user.update({
      where: { id: user.id },
      data: { totpSecret: seal(secret), totpEnabledAt: new Date() },
    });

    await login({ email: user.email, password: TEST_PASSWORD });

    const code = generateTotp(secret);
    await completeChallenge(code);

    // The challenge is consumed. Replaying the same cookie and code must not
    // mint a second session, even though the code itself is still in its
    // valid time window.
    await expect(completeChallenge(code)).rejects.toThrow();
    expect(await db.session.count({ where: { userId: user.id } })).toBe(1);
  });

  it('still issues a session directly when 2FA is off', async () => {
    const user = await createUser();

    const result = await login({ email: user.email, password: TEST_PASSWORD });

    expect(result.requiresTwoFactor).toBe(false);
    expect((await getSession())?.id).toBe(user.id);
  });
});
