/**
 * Referral attribution primitives.
 *
 * Lives in `lib` rather than `server` because the middleware runs on the edge
 * runtime and cannot import anything that reaches Prisma. Both sides of the
 * attribution — the middleware that writes the cookie and the checkout that
 * reads it — must agree on this format exactly.
 */

export const REFERRAL_COOKIE = 'aut_ref';
export const REFERRAL_PARAM = 'ref';

/**
 * Upper bound on how long a referral cookie lives in the browser.
 *
 * The attribution window that actually decides a commission is per programme
 * (`cookieDays`), and the edge has no database to look it up in. So the cookie
 * carries the widest window any programme may configure, stamps the click
 * time, and the server enforces the real window at checkout. A creator
 * shortening their window takes effect immediately, including for cookies
 * already sitting in browsers.
 */
export const REFERRAL_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/** Mirrors CODE_ALPHABET in the affiliate service — no 0/O/1/I/L. */
const CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{10}$/;

export function isValidReferralCode(value: string): boolean {
  return CODE_PATTERN.test(value);
}

export interface ReferralCookie {
  code: string;
  clickedAt: Date;
}

/** `CODE.epochSeconds` — short enough to stay well inside cookie limits. */
export function formatReferralCookie(code: string, clickedAt: Date): string {
  return `${code}.${Math.floor(clickedAt.getTime() / 1000)}`;
}

/**
 * Parses a referral cookie, rejecting anything malformed.
 *
 * The value is attacker-controlled — anyone can set a cookie — so a failure
 * here returns null and the purchase proceeds unattributed rather than
 * throwing. A future timestamp is rejected too: it would otherwise let someone
 * mint an attribution window that never expires.
 */
export function parseReferralCookie(value: string | undefined): ReferralCookie | null {
  if (!value) return null;

  const separator = value.lastIndexOf('.');
  if (separator <= 0) return null;

  const code = value.slice(0, separator);
  const stamp = Number(value.slice(separator + 1));

  if (!isValidReferralCode(code)) return null;
  if (!Number.isInteger(stamp) || stamp <= 0) return null;

  const clickedAt = new Date(stamp * 1000);
  if (clickedAt.getTime() > Date.now() + 60_000) return null;

  return { code, clickedAt };
}

/** Whether a click still falls inside a programme's attribution window. */
export function isWithinWindow(clickedAt: Date, cookieDays: number): boolean {
  const elapsed = Date.now() - clickedAt.getTime();
  return elapsed >= 0 && elapsed <= cookieDays * 24 * 60 * 60 * 1000;
}
