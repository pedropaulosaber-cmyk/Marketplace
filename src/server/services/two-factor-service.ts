import 'server-only';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { db } from '@/server/db/client';
import { requireUser } from '@/server/auth/rbac';
import { createSession } from '@/server/auth/session';
import { verifyPassword } from '@/server/auth/password';
import { audit } from '@/server/security/audit';
import { enforceRateLimit } from '@/server/security/rate-limit';
import { fingerprint, generateToken } from '@/server/security/crypto';
import { open, seal } from '@/server/security/encryption';
import {
  generateTotpSecret,
  totpEnrolmentUri,
  verifyTotp,
} from '@/server/security/totp';
import { conflict, notFound, validation } from '@/lib/errors';
import { securityLog } from '@/lib/logger';
import { isProduction } from '@/lib/env';

/**
 * Two-factor authentication.
 *
 * The design point: a password is one shared secret that can be phished,
 * reused from another site's breach, or read from a leaked database. Every
 * other control here assumes the password holds. This is the layer that
 * survives it not holding.
 */

export const CHALLENGE_COOKIE = '__Host-automatize_2fa';

/** Short by design — this is a login step, not a session. */
const CHALLENGE_TTL_MS = 5 * 60_000;

/** Wrong codes tolerated against one challenge before it is burned. */
const MAX_CHALLENGE_ATTEMPTS = 5;

const RECOVERY_CODE_COUNT = 10;

function challengeCookieName(): string {
  return isProduction ? CHALLENGE_COOKIE : 'automatize_2fa';
}

// ---------------------------------------------------------------------------
// Enrolment
// ---------------------------------------------------------------------------

/**
 * Starts enrolment: generates a secret and returns it for display.
 *
 * The secret is stored immediately but `totpEnabledAt` stays null, so it is
 * inert until proven. Storing it only after confirmation would mean holding it
 * in a cookie or hidden field between the two steps, which is a worse place
 * for it than the database.
 */
export async function beginTotpEnrolment(): Promise<{
  secret: string;
  uri: string;
}> {
  const user = await requireUser();

  const existing = await db.user.findUnique({
    where: { id: user.id },
    select: { totpEnabledAt: true, email: true },
  });

  if (existing?.totpEnabledAt) {
    throw conflict('A verificação em duas etapas já está ativa nesta conta.');
  }

  const secret = generateTotpSecret();

  await db.user.update({
    where: { id: user.id },
    data: { totpSecret: seal(secret), totpEnabledAt: null },
  });

  return {
    secret,
    uri: totpEnrolmentUri(secret, existing?.email ?? user.email),
  };
}

/**
 * Confirms enrolment with a code from the authenticator, and issues recovery
 * codes.
 *
 * Recovery codes are returned exactly once, here. They are stored as
 * fingerprints, so there is no path — for us or for an attacker with the
 * database — to display them again.
 */
export async function confirmTotpEnrolment(code: string): Promise<string[]> {
  const user = await requireUser();
  await enforceRateLimit('login', user.id);

  const record = await db.user.findUnique({
    where: { id: user.id },
    select: { totpSecret: true, totpEnabledAt: true },
  });

  if (!record?.totpSecret) {
    throw validation('Comece a configuração antes de confirmar o código.');
  }
  if (record.totpEnabledAt) {
    throw conflict('A verificação em duas etapas já está ativa nesta conta.');
  }

  const secret = open(record.totpSecret);
  if (!secret || !verifyTotp(secret, code)) {
    throw validation('Código inválido. Confira o app e tente de novo.', {
      code: ['Código inválido.'],
    });
  }

  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
    randomBytes(5).toString('hex').toUpperCase()
  );

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { totpEnabledAt: new Date() },
    });

    // Replace rather than append: re-enrolling must invalidate codes printed
    // for a previous device.
    await tx.recoveryCode.deleteMany({ where: { userId: user.id } });
    await tx.recoveryCode.createMany({
      data: codes.map((value) => ({
        userId: user.id,
        codeHash: fingerprint(value),
      })),
    });

    await audit(
      {
        actorId: user.id,
        action: 'user.two_factor_enabled',
        entityType: 'User',
        entityId: user.id,
      },
      tx
    );
  });

  return codes;
}

/**
 * Turns 2FA off. Requires the current password.
 *
 * Removing a factor is exactly what someone who has stolen a live session
 * would want to do, so it re-proves possession of the password rather than
 * trusting the session alone.
 */
export async function disableTwoFactor(password: string): Promise<void> {
  const user = await requireUser();
  await enforceRateLimit('login', user.id);

  const record = await db.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  if (!record || !(await verifyPassword(record.passwordHash, password))) {
    throw validation('Senha incorreta.', { password: ['Senha incorreta.'] });
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { totpSecret: null, totpEnabledAt: null },
    });
    await tx.recoveryCode.deleteMany({ where: { userId: user.id } });

    await audit(
      {
        actorId: user.id,
        action: 'user.two_factor_disabled',
        entityType: 'User',
        entityId: user.id,
      },
      tx
    );
  });
}

// ---------------------------------------------------------------------------
// Login challenge
// ---------------------------------------------------------------------------

/** Whether a completed password check still needs a second factor. */
export async function requiresSecondFactor(userId: string): Promise<boolean> {
  const record = await db.user.findUnique({
    where: { id: userId },
    select: { totpEnabledAt: true },
  });

  return Boolean(record?.totpEnabledAt);
}

/**
 * Issues a pending-second-factor challenge and sets its cookie.
 *
 * The cookie carries an opaque token; only its fingerprint is stored, so a
 * database leak cannot be replayed into a half-authenticated state.
 */
export async function issueChallenge(userId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

  await db.twoFactorChallenge.create({
    data: { userId, tokenHash: fingerprint(token), expiresAt },
  });

  const jar = await cookies();
  jar.set(challengeCookieName(), token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

/** Clears the challenge cookie. */
async function clearChallengeCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(challengeCookieName());
}

/** The account a live challenge belongs to, if there is one. */
export async function pendingChallengeUser(): Promise<{
  userId: string;
  email: string;
} | null> {
  const jar = await cookies();
  const token = jar.get(challengeCookieName())?.value;
  if (!token) return null;

  const challenge = await db.twoFactorChallenge.findUnique({
    where: { tokenHash: fingerprint(token) },
    select: {
      consumedAt: true,
      expiresAt: true,
      attempts: true,
      user: { select: { id: true, email: true } },
    },
  });

  if (!challenge) return null;
  if (challenge.consumedAt) return null;
  if (challenge.expiresAt.getTime() <= Date.now()) return null;
  if (challenge.attempts >= MAX_CHALLENGE_ATTEMPTS) return null;

  return { userId: challenge.user.id, email: challenge.user.email };
}

/**
 * Completes login with a TOTP code or a recovery code.
 *
 * The challenge is consumed inside the same transaction that creates nothing
 * else, and the session is only created after it succeeds — so a replayed
 * request finds the challenge already consumed rather than minting a second
 * session.
 */
export async function completeChallenge(submitted: string): Promise<void> {
  const jar = await cookies();
  const token = jar.get(challengeCookieName())?.value;

  const genericFailure = () =>
    validation('Código inválido ou expirado.', {
      code: ['Código inválido ou expirado.'],
    });

  if (!token) throw genericFailure();

  await enforceRateLimit('login');

  const tokenHash = fingerprint(token);

  const challenge = await db.twoFactorChallenge.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      attempts: true,
      consumedAt: true,
      expiresAt: true,
      user: { select: { totpSecret: true, totpEnabledAt: true, status: true } },
    },
  });

  if (
    !challenge ||
    challenge.consumedAt ||
    challenge.expiresAt.getTime() <= Date.now() ||
    challenge.attempts >= MAX_CHALLENGE_ATTEMPTS ||
    !challenge.user.totpEnabledAt ||
    challenge.user.status !== 'ACTIVE'
  ) {
    await clearChallengeCookie();
    throw genericFailure();
  }

  const cleaned = submitted.trim().toUpperCase();
  const secret = challenge.user.totpSecret
    ? open(challenge.user.totpSecret)
    : null;

  const totpOk = secret ? verifyTotp(secret, cleaned) : false;

  // Recovery codes are consumed by a conditional update, so two concurrent
  // requests cannot both spend the same one.
  let recoveryOk = false;
  if (!totpOk) {
    const consumed = await db.recoveryCode.updateMany({
      where: {
        userId: challenge.userId,
        codeHash: fingerprint(cleaned),
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });
    recoveryOk = consumed.count === 1;
  }

  if (!totpOk && !recoveryOk) {
    await db.twoFactorChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });

    securityLog.warn(
      { userId: challenge.userId },
      'failed second-factor attempt'
    );

    throw genericFailure();
  }

  // Consume the challenge conditionally: the update matches only while it is
  // still unconsumed, so a replay cannot turn one challenge into two sessions.
  const consumedChallenge = await db.twoFactorChallenge.updateMany({
    where: { id: challenge.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  if (consumedChallenge.count !== 1) {
    await clearChallengeCookie();
    throw genericFailure();
  }

  await createSession(challenge.userId);
  await clearChallengeCookie();

  await audit({
    actorId: challenge.userId,
    action: 'user.login',
    entityType: 'User',
    entityId: challenge.userId,
    metadata: { secondFactor: recoveryOk ? 'recovery_code' : 'totp' },
  });

  if (recoveryOk) {
    securityLog.warn(
      { userId: challenge.userId },
      'login completed with a recovery code'
    );
  }
}

/** Status for the settings screen. */
export async function twoFactorStatus(userId: string): Promise<{
  enabled: boolean;
  recoveryCodesRemaining: number;
}> {
  const [record, remaining] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { totpEnabledAt: true },
    }),
    db.recoveryCode.count({ where: { userId, usedAt: null } }),
  ]);

  if (!record) throw notFound('Conta não encontrada.');

  return {
    enabled: Boolean(record.totpEnabledAt),
    recoveryCodesRemaining: remaining,
  };
}
