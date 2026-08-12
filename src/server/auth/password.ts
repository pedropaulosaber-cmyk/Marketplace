import 'server-only';
import { hash, verify, type Algorithm } from '@node-rs/argon2';

/**
 * Password hashing.
 *
 * Argon2id is the current OWASP recommendation: memory-hard, so GPU and ASIC
 * attacks gain far less than they do against SHA-family or bcrypt. Parameters
 * follow the OWASP cheat sheet minimum (19 MiB, t=2, p=1).
 *
 * Passwords are never stored, logged, or transmitted anywhere except into
 * this module.
 */
/**
 * `Algorithm` is declared as an ambient `const enum`, which cannot be read as a
 * value under `isolatedModules`. Argon2id is 2 in that enum; the cast keeps the
 * parameter typed while avoiding the ambient access.
 */
const ARGON2ID = 2 as Algorithm;

const OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

/**
 * Verifies a password against a stored hash.
 *
 * Returns false rather than throwing on a malformed hash so a corrupted row
 * can't be used to distinguish "no such user" from "bad stored data" — both
 * are just a failed login.
 */
export async function verifyPassword(
  storedHash: string,
  plain: string
): Promise<boolean> {
  try {
    return await verify(storedHash, plain, OPTIONS);
  } catch {
    return false;
  }
}

/**
 * A hash of a throwaway value, used to equalise timing when an account does
 * not exist. Without this, "user not found" returns measurably faster than
 * "wrong password", which lets an attacker enumerate registered emails.
 */
export const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR2YWx1ZQ$0000000000000000000000000000000000000000000';

export async function burnTiming(plain: string): Promise<void> {
  await verifyPassword(DUMMY_HASH, plain);
}
