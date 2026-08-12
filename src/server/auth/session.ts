import 'server-only';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { db } from '@/server/db/client';
import { isProduction } from '@/lib/env';
import { fingerprint, generateToken, hashIp } from '@/server/security/crypto';
import type { Role, UserStatus } from '@prisma/client';

/**
 * Session management.
 *
 * Design: opaque random tokens in an HttpOnly cookie, with only an HMAC
 * fingerprint persisted. Chosen over stateless JWTs because a marketplace
 * needs immediate revocation — banning an account or accepting a proposal must
 * take effect on the next request, not when a token happens to expire.
 */

export const SESSION_COOKIE = '__Host-automatize_session';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
/** Sliding refresh: extend the session when it is more than a day old. */
const REFRESH_AFTER_MS = 1000 * 60 * 60 * 24;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  roles: Role[];
}

/**
 * Cookie attributes.
 *
 * `__Host-` prefix requires Secure + Path=/ + no Domain, which browsers
 * enforce — it prevents a subdomain from writing a session cookie for the
 * apex. In development over plain HTTP the prefix cannot be used, so the
 * name falls back automatically.
 */
function cookieName(): string {
  return isProduction ? SESSION_COOKIE : 'automatize_session';
}

function cookieOptions(expires: Date) {
  return {
    httpOnly: true, // never readable from JavaScript — blunts XSS token theft
    secure: isProduction,
    sameSite: 'lax' as const, // survives top-level navigation, blocks CSRF POSTs
    path: '/',
    expires,
  };
}

async function requestMeta() {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() ?? h.get('x-real-ip');
  return {
    ipHash: hashIp(ip),
    userAgent: h.get('user-agent')?.slice(0, 512) ?? null,
  };
}

/** Issues a new session and sets the cookie. Called only after auth succeeds. */
export async function createSession(userId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const meta = await requestMeta();

  await db.session.create({
    data: {
      userId,
      tokenHash: fingerprint(token),
      expiresAt,
      ipHash: meta.ipHash,
      userAgent: meta.userAgent,
    },
  });

  const jar = await cookies();
  jar.set(cookieName(), token, cookieOptions(expiresAt));
}

/**
 * Resolves the current session from the cookie.
 *
 * Wrapped in React `cache` so the many components that need the current user
 * during one render share a single database round-trip.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(cookieName())?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: fingerprint(token) },
    select: {
      id: true,
      expiresAt: true,
      revokedAt: true,
      lastActivityAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          deletedAt: true,
          roles: { select: { role: true } },
        },
      },
    },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;

  // A suspended, banned or deleted account loses access immediately, even
  // with a still-valid session token.
  const { user } = session;
  if (user.deletedAt || user.status !== 'ACTIVE') return null;

  // Sliding expiry, throttled so a busy page does not write on every request.
  if (Date.now() - session.lastActivityAt.getTime() > REFRESH_AFTER_MS) {
    await db.session
      .update({
        where: { id: session.id },
        data: {
          lastActivityAt: new Date(),
          expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        },
      })
      .catch(() => {
        // A failed refresh must not break the request; the session is still
        // valid until its current expiry.
      });
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    roles: user.roles.map((r) => r.role),
  };
});

/** Revokes the current session and clears the cookie. */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const name = cookieName();
  const token = jar.get(name)?.value;

  if (token) {
    await db.session
      .updateMany({
        where: { tokenHash: fingerprint(token), revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch(() => {
        // Best-effort: the cookie is cleared regardless, so the browser can no
        // longer present the token.
      });
  }

  jar.delete(name);
}

/**
 * Revokes every session for a user. Used on password change, on ban, and
 * whenever a user asks to sign out everywhere — an attacker holding a stolen
 * token must lose it the moment the owner reacts.
 */
export async function revokeAllSessions(userId: string): Promise<void> {
  await db.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
