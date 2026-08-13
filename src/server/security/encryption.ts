import 'server-only';
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import { env } from '@/lib/env';

/**
 * Authenticated encryption for secrets that must be recoverable.
 *
 * Passwords are hashed, not encrypted — they only ever need comparing. A TOTP
 * secret is different: the server has to reproduce it on every verification,
 * so it must be stored reversibly. That makes it the one class of data where
 * a database leak alone should still not be enough, and where encryption at
 * rest earns its keep.
 *
 * AES-256-GCM rather than CBC or CTR: GCM authenticates the ciphertext, so a
 * tampered value fails to decrypt instead of silently producing different
 * plaintext. Every seal draws a fresh random IV, which is what keeps two
 * identical secrets from producing identical ciphertext.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // 96 bits, the size GCM is specified for
const TAG_BYTES = 16;

/**
 * The key is derived from SESSION_SECRET rather than configured separately.
 *
 * HKDF with a distinct `info` string means this key and any other derived for
 * a different purpose are cryptographically unrelated — deriving them by
 * simply hashing the same secret would not give that. The trade-off is
 * explicit: rotating SESSION_SECRET invalidates stored TOTP secrets, so a
 * rotation has to be paired with asking affected users to re-enrol. That is
 * an acceptable cost for not adding a second mandatory secret to every deploy,
 * and SESSION_SECRET already has to be stable or every session breaks anyway.
 */
function key(): Buffer {
  return Buffer.from(
    hkdfSync('sha256', env.SESSION_SECRET, 'automatize.totp.v1', 'encryption', 32)
  );
}

/** Encrypts a UTF-8 string. Output is base64 of `iv | tag | ciphertext`. */
export function seal(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
}

/**
 * Decrypts a value produced by `seal`.
 *
 * Returns null rather than throwing on any failure — wrong key, truncated
 * value, tampered ciphertext. Callers are handling stored data that may
 * predate a key change, and a thrown error there would take down a login page
 * rather than degrade one account.
 */
export function open(sealed: string): string | null {
  try {
    const raw = Buffer.from(sealed, 'base64');
    if (raw.length <= IV_BYTES + TAG_BYTES) return null;

    const iv = raw.subarray(0, IV_BYTES);
    const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
    const ciphertext = raw.subarray(IV_BYTES + TAG_BYTES);

    const decipher = createDecipheriv(ALGORITHM, key(), iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}
