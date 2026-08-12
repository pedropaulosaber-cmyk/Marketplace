import 'server-only';
import { db } from '@/server/db/client';
import { hashPassword, verifyPassword, burnTiming } from '@/server/auth/password';
import { createSession, revokeAllSessions } from '@/server/auth/session';
import { enforceRateLimit } from '@/server/security/rate-limit';
import { audit } from '@/server/security/audit';
import {
  issueChallenge,
  requiresSecondFactor,
} from '@/server/services/two-factor-service';
import { conflict, validation } from '@/lib/errors';
import { securityLog } from '@/lib/logger';
import { slugify } from '@/lib/validation/common';
import type { Role } from '@prisma/client';
import type { z } from 'zod';
import type {
  loginSchema,
  registerSchema,
  changePasswordSchema,
} from '@/lib/validation/schemas';

/**
 * Authentication service.
 *
 * All login/registration policy lives here so there is exactly one path into
 * an authenticated session, and one place where lockout, timing and auditing
 * are handled.
 */

/** Progressive lockout after repeated failures on a single account. */
const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_MS = 15 * 60_000;

/** The role a new account starts with, from the signup intent. */
const INTENT_ROLE: Record<'buy' | 'sell' | 'work', Role> = {
  buy: 'BUYER',
  sell: 'CREATOR',
  work: 'PROFESSIONAL',
};

export async function register(
  input: z.infer<typeof registerSchema>
): Promise<{ userId: string }> {
  await enforceRateLimit('register');

  const email = input.email.toLowerCase();

  // Roles are derived from a closed enum, never taken from the request body —
  // otherwise anyone could self-grant ADMIN at signup.
  const role = INTENT_ROLE[input.intent];

  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    // The email is already visible to whoever owns it, and a registration form
    // cannot avoid revealing collisions without breaking usability. We accept
    // the disclosure here but keep login itself non-enumerable.
    throw conflict('Já existe uma conta com este e-mail.');
  }

  const passwordHash = await hashPassword(input.password);

  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        name: input.name,
        passwordHash,
        roles: { create: { role } },
        profile: { create: {} },
      },
      select: { id: true },
    });

    // A professional needs a profile to appear in the directory at all.
    if (role === 'PROFESSIONAL') {
      const base = slugify(input.name) || 'profissional';
      await tx.professionalProfile.create({
        data: {
          userId: created.id,
          slug: `${base}-${created.id.slice(-6)}`,
          title: 'Especialista em automação',
          field: 'Agentes de IA',
          bio: 'Complete seu perfil para começar a receber demandas.',
          location: 'Brasil',
          rateMinCents: 0,
          rateMaxCents: 0,
          availability: 'NOW',
        },
      });
    }

    await audit(
      {
        actorId: created.id,
        action: 'user.registered',
        entityType: 'User',
        entityId: created.id,
        metadata: { role },
      },
      tx
    );

    return created;
  });

  await createSession(user.id);

  return { userId: user.id };
}

export async function login(
  input: z.infer<typeof loginSchema>
): Promise<{ userId: string; requiresTwoFactor: boolean }> {
  // Limit by IP first: this runs before we know which account is targeted, so
  // it is what actually blunts credential stuffing across many accounts.
  await enforceRateLimit('login');

  const email = input.email.toLowerCase();

  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      passwordHash: true,
      status: true,
      deletedAt: true,
      failedLoginCount: true,
      lockedUntil: true,
    },
  });

  // Same generic message for every failure mode below, so the response cannot
  // be used to tell registered emails from unregistered ones.
  const genericFailure = () =>
    validation('E-mail ou senha incorretos.', {
      password: ['E-mail ou senha incorretos.'],
    });

  if (!user || user.deletedAt) {
    // Spend comparable CPU to a real verification so the timing matches.
    await burnTiming(input.password);
    securityLog.info({ email }, 'login attempt for unknown account');
    throw genericFailure();
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    securityLog.warn({ userId: user.id }, 'login attempt on locked account');
    throw validation(
      'Conta temporariamente bloqueada por tentativas repetidas. Tente novamente em alguns minutos.',
      { password: ['Conta temporariamente bloqueada.'] }
    );
  }

  const ok = await verifyPassword(user.passwordHash, input.password);

  if (!ok) {
    const attempts = user.failedLoginCount + 1;
    const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;

    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: attempts,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_MS) : null,
      },
    });

    await audit({
      actorId: user.id,
      action: 'user.login_failed',
      entityType: 'User',
      entityId: user.id,
      metadata: { attempts, locked: shouldLock },
    });

    throw genericFailure();
  }

  // A suspended or banned account authenticates but must not get a session.
  if (user.status !== 'ACTIVE') {
    securityLog.warn(
      { userId: user.id, status: user.status },
      'login blocked for non-active account'
    );
    throw validation(
      'Esta conta está suspensa. Fale com o suporte para mais informações.',
      { email: ['Conta suspensa.'] }
    );
  }

  // Successful login clears the failure counter.
  if (user.failedLoginCount > 0 || user.lockedUntil) {
    await db.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
  }

  // With a second factor configured the password alone earns a challenge, not
  // a session. Nothing authenticated exists until the factor is proven, so a
  // stolen password gets an attacker to a code prompt and no further.
  if (await requiresSecondFactor(user.id)) {
    await issueChallenge(user.id);

    await audit({
      actorId: user.id,
      action: 'user.two_factor_challenged',
      entityType: 'User',
      entityId: user.id,
    });

    return { userId: user.id, requiresTwoFactor: true };
  }

  await createSession(user.id);

  await audit({
    actorId: user.id,
    action: 'user.login',
    entityType: 'User',
    entityId: user.id,
  });

  return { userId: user.id, requiresTwoFactor: false };
}

export async function changePassword(
  userId: string,
  input: z.infer<typeof changePasswordSchema>
): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user) throw validation('Conta não encontrada.');

  const ok = await verifyPassword(user.passwordHash, input.currentPassword);
  if (!ok) {
    throw validation('Senha atual incorreta.', {
      currentPassword: ['Senha atual incorreta.'],
    });
  }

  const passwordHash = await hashPassword(input.newPassword);

  await db.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  // Any session opened with the old password is now untrusted. Revoking all of
  // them is the whole point of a password change after a suspected breach.
  await revokeAllSessions(userId);

  await audit({
    actorId: userId,
    action: 'user.password_changed',
    entityType: 'User',
    entityId: userId,
  });
}
