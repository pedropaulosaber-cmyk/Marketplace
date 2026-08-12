import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Time-based one-time passwords (RFC 6238).
 *
 * Implemented directly on node's HMAC rather than pulling in a library. TOTP
 * is a thin, fully specified construction — HMAC-SHA1 over a counter, then a
 * fixed truncation — so this is composing a standard primitive, not inventing
 * cryptography, and it keeps a dependency out of the authentication path
 * where supply-chain risk is least acceptable.
 *
 * SHA-1 is correct here despite its collision weaknesses: HMAC-SHA1 is not
 * affected by them, and it is what every authenticator app implements. Using
 * SHA-256 would silently lock out Google Authenticator and most others.
 */

const STEP_SECONDS = 30;
const DIGITS = 6;

/**
 * How many steps either side of now are accepted.
 *
 * One step (±30s) absorbs ordinary clock drift between a phone and the
 * server. Widening it multiplies the number of codes valid at any instant,
 * which is a direct trade against brute force — and the login limiter assumes
 * this window stays small.
 */
const DRIFT_STEPS = 1;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Base32 (RFC 4648, no padding) — the encoding authenticator apps expect. */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];

  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');

  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error('invalid base32 character');

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/** A fresh 160-bit secret — the size RFC 4226 recommends for HMAC-SHA1. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

function codeForCounter(secret: Buffer, counter: number): string {
  // 8-byte big-endian counter. Written via BigInt so the high word is correct
  // past 2^32, which a bitwise implementation would silently truncate.
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac('sha1', secret).update(buffer).digest();

  // Dynamic truncation, RFC 4226 §5.3: the low nibble of the last byte picks
  // the offset, and the high bit is masked so the result is not sign-extended.
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    (digest[offset + 1]! << 16) |
    (digest[offset + 2]! << 8) |
    digest[offset + 3]!;

  return (binary % 10 ** DIGITS).toString().padStart(DIGITS, '0');
}

/** The code valid at a given instant. Exported for tests and enrolment. */
export function generateTotp(secret: string, at: Date = new Date()): string {
  const counter = Math.floor(at.getTime() / 1000 / STEP_SECONDS);
  return codeForCounter(base32Decode(secret), counter);
}

/**
 * Verifies a submitted code against the accepted drift window.
 *
 * The comparison is constant-time. A fast string compare leaks, through
 * timing, how many leading digits were right, which is enough to reconstruct
 * a code digit by digit given sufficient attempts.
 */
export function verifyTotp(
  secret: string,
  submitted: string,
  at: Date = new Date()
): boolean {
  const cleaned = submitted.replace(/\s/g, '');
  if (!/^\d{6}$/.test(cleaned)) return false;

  let key: Buffer;
  try {
    key = base32Decode(secret);
  } catch {
    return false;
  }

  const counter = Math.floor(at.getTime() / 1000 / STEP_SECONDS);
  const submittedBuffer = Buffer.from(cleaned, 'utf8');

  let matched = false;

  // Every candidate is checked even after a match, so the time taken does not
  // reveal which step in the window was the correct one.
  for (let drift = -DRIFT_STEPS; drift <= DRIFT_STEPS; drift += 1) {
    const candidate = Buffer.from(codeForCounter(key, counter + drift), 'utf8');

    if (
      candidate.length === submittedBuffer.length &&
      timingSafeEqual(candidate, submittedBuffer)
    ) {
      matched = true;
    }
  }

  return matched;
}

/** The URI an authenticator app scans. Never logged — it carries the secret. */
export function totpEnrolmentUri(
  secret: string,
  accountEmail: string,
  issuer = 'AUTOMATIZE'
): string {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });

  return `otpauth://totp/${label}?${params.toString()}`;
}
