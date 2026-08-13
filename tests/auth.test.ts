import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  db,
  resetDatabase,
  createUser,
  signIn,
  signOut,
  TEST_PASSWORD,
  unique,
} from './helpers';
import { login, register, changePassword } from '@/server/services/auth-service';
import { getSession, revokeAllSessions } from '@/server/auth/session';
import { requireUser, requirePermission } from '@/server/auth/rbac';
import { verifyPassword } from '@/server/auth/password';
import { __resetRateLimits } from '@/server/security/rate-limit';
import { isAppError } from '@/lib/errors';

/**
 * Authentication and session behaviour, exercised against the real database.
 */

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await db.$disconnect();
});

describe('register', () => {
  it('creates an account, hashes the password and opens a session', async () => {
    const email = `${unique('novo')}@test.dev`;

    const { userId } = await register({
      name: 'Marina Duarte',
      email,
      password: 'uma-senha-bem-longa',
      confirmPassword: 'uma-senha-bem-longa',
      intent: 'buy',
      acceptTerms: true,
    });

    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true, email: true, roles: true },
    });

    // The plaintext must appear nowhere in the stored record.
    expect(user.passwordHash).not.toContain('uma-senha-bem-longa');
    expect(user.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(user.passwordHash, 'uma-senha-bem-longa')).toBe(
      true
    );

    expect(user.email).toBe(email.toLowerCase());
    expect(user.roles.map((r) => r.role)).toEqual(['BUYER']);

    const session = await getSession();
    expect(session?.id).toBe(userId);
  });

  it('assigns the role from the intent, never an escalated one', async () => {
    const cases = [
      ['buy', 'BUYER'],
      ['sell', 'CREATOR'],
      ['work', 'PROFESSIONAL'],
    ] as const;

    for (const [intent, expectedRole] of cases) {
      const email = `${unique(intent)}@test.dev`;

      const { userId } = await register({
        name: 'Pessoa Teste',
        email,
        password: 'uma-senha-bem-longa',
        confirmPassword: 'uma-senha-bem-longa',
        intent,
        acceptTerms: true,
      });

      const roles = await db.userRole.findMany({
        where: { userId },
        select: { role: true },
      });

      expect(roles.map((r) => r.role)).toContain(expectedRole);
      expect(roles.map((r) => r.role)).not.toContain('ADMIN');
    }
  });

  it('gives a professional signup a directory profile', async () => {
    const { userId } = await register({
      name: 'Camila Reis',
      email: `${unique('pro')}@test.dev`,
      password: 'uma-senha-bem-longa',
      confirmPassword: 'uma-senha-bem-longa',
      intent: 'work',
      acceptTerms: true,
    });

    const profile = await db.professionalProfile.findUnique({
      where: { userId },
      select: { slug: true },
    });

    expect(profile).not.toBeNull();
  });

  it('refuses a duplicate email', async () => {
    const email = `${unique('dup')}@test.dev`;
    const payload = {
      name: 'Primeira Pessoa',
      email,
      password: 'uma-senha-bem-longa',
      confirmPassword: 'uma-senha-bem-longa',
      intent: 'buy' as const,
      acceptTerms: true as const,
    };

    await register(payload);
    await expect(register(payload)).rejects.toSatisfy(
      (e: unknown) => isAppError(e) && e.code === 'CONFLICT'
    );
  });
});

describe('login', () => {
  it('signs in with correct credentials', async () => {
    const user = await createUser();
    signOut();

    const { userId } = await login({
      email: user.email,
      password: TEST_PASSWORD,
    });

    expect(userId).toBe(user.id);
    expect((await getSession())?.id).toBe(user.id);
  });

  it('rejects a wrong password', async () => {
    const user = await createUser();

    await expect(
      login({ email: user.email, password: 'senha-completamente-errada' })
    ).rejects.toThrow();

    expect(await getSession()).toBeNull();
  });

  it('gives the same error for an unknown email as for a wrong password', async () => {
    const user = await createUser();

    const wrongPassword = await login({
      email: user.email,
      password: 'senha-errada-mas-longa',
    }).catch((e: unknown) => e);

    const unknownEmail = await login({
      email: `${unique('fantasma')}@test.dev`,
      password: 'senha-errada-mas-longa',
    }).catch((e: unknown) => e);

    // Identical messages: the response cannot be used to enumerate accounts.
    expect(isAppError(wrongPassword) && wrongPassword.message).toBe(
      isAppError(unknownEmail) && unknownEmail.message
    );
  });

  it('rate-limits repeated attempts from one address before the account locks', async () => {
    const user = await createUser();

    let rateLimited = 0;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await login({ email: user.email, password: 'errada-de-proposito' }).catch(
        (e: unknown) => {
          if (isAppError(e) && e.code === 'RATE_LIMITED') rateLimited += 1;
        }
      );
    }

    // The per-IP limiter is the outer layer and stops the burst well before
    // the per-account counter could reach its threshold.
    expect(rateLimited).toBeGreaterThan(0);

    const record = await db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { failedLoginCount: true },
    });
    expect(record.failedLoginCount).toBeLessThan(10);
  });

  it('locks the account after enough failures to defeat IP rotation', async () => {
    const user = await createUser();

    // Clearing the limiter between attempts simulates an attacker spreading a
    // credential-stuffing run across many addresses, which is exactly the case
    // the per-account lockout exists to cover.
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await __resetRateLimits();
      await login({ email: user.email, password: 'errada-de-proposito' }).catch(
        () => undefined
      );
    }

    const locked = await db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { lockedUntil: true, failedLoginCount: true },
    });

    expect(locked.failedLoginCount).toBeGreaterThanOrEqual(10);
    expect(locked.lockedUntil).not.toBeNull();

    // Even the correct password is refused while the lock holds.
    await __resetRateLimits();
    await expect(
      login({ email: user.email, password: TEST_PASSWORD })
    ).rejects.toThrow();
  });

  it('clears the failure counter on a successful login', async () => {
    const user = await createUser();

    await login({ email: user.email, password: 'errada' }).catch(() => undefined);
    await login({ email: user.email, password: TEST_PASSWORD });

    const fresh = await db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { failedLoginCount: true, lockedUntil: true },
    });

    expect(fresh.failedLoginCount).toBe(0);
    expect(fresh.lockedUntil).toBeNull();
  });

  it('refuses a suspended account even with the right password', async () => {
    const user = await createUser({ status: 'SUSPENDED' });
    signOut();

    await expect(
      login({ email: user.email, password: TEST_PASSWORD })
    ).rejects.toThrow();

    expect(await getSession()).toBeNull();
  });
});

describe('sessions', () => {
  it('stores only a fingerprint, never the token itself', async () => {
    const user = await createUser();
    await signIn(user.id);

    const session = await db.session.findFirstOrThrow({
      where: { userId: user.id },
      select: { tokenHash: true },
    });

    // A 64-char hex HMAC, not the base64url token the cookie carries.
    expect(session.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('drops a session as soon as the account is suspended', async () => {
    const user = await createUser();
    await signIn(user.id);

    expect((await getSession())?.id).toBe(user.id);

    await db.user.update({
      where: { id: user.id },
      data: { status: 'SUSPENDED' },
    });

    // Same cookie, but the session no longer resolves.
    expect(await getSession()).toBeNull();
  });

  it('drops a session once it is revoked', async () => {
    const user = await createUser();
    await signIn(user.id);

    await revokeAllSessions(user.id);

    expect(await getSession()).toBeNull();
  });

  it('drops an expired session', async () => {
    const user = await createUser();
    await signIn(user.id);

    await db.session.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect(await getSession()).toBeNull();
  });
});

describe('changePassword', () => {
  it('rejects a wrong current password', async () => {
    const user = await createUser();
    await signIn(user.id);

    await expect(
      changePassword(user.id, {
        currentPassword: 'nao-e-a-senha-atual',
        newPassword: 'nova-senha-bem-longa',
        confirmPassword: 'nova-senha-bem-longa',
      })
    ).rejects.toThrow();
  });

  it('revokes every session after a successful change', async () => {
    const user = await createUser();
    await signIn(user.id);

    await changePassword(user.id, {
      currentPassword: TEST_PASSWORD,
      newPassword: 'nova-senha-bem-longa',
      confirmPassword: 'nova-senha-bem-longa',
    });

    // The old cookie is now worthless — this is what makes a password change
    // an effective response to a suspected compromise.
    expect(await getSession()).toBeNull();

    const live = await db.session.count({
      where: { userId: user.id, revokedAt: null },
    });
    expect(live).toBe(0);
  });
});

describe('authorization guards', () => {
  it('requireUser rejects an anonymous caller', async () => {
    signOut();
    await expect(requireUser()).rejects.toSatisfy(
      (e: unknown) => isAppError(e) && e.code === 'UNAUTHENTICATED'
    );
  });

  it('requirePermission rejects a role that lacks the capability', async () => {
    const buyer = await createUser({ roles: ['BUYER'] });
    await signIn(buyer.id);

    await expect(requirePermission('product:moderate')).rejects.toSatisfy(
      (e: unknown) => isAppError(e) && e.code === 'FORBIDDEN'
    );
    await expect(requirePermission('admin:access')).rejects.toSatisfy(
      (e: unknown) => isAppError(e) && e.code === 'FORBIDDEN'
    );
  });

  it('requirePermission allows a role that has the capability', async () => {
    const admin = await createUser({ roles: ['ADMIN'] });
    await signIn(admin.id);

    await expect(requirePermission('admin:access')).resolves.toMatchObject({
      id: admin.id,
    });
  });

  it('lets a creator publish but not moderate', async () => {
    const creator = await createUser({ roles: ['CREATOR'] });
    await signIn(creator.id);

    await expect(requirePermission('product:create')).resolves.toBeTruthy();
    await expect(requirePermission('product:moderate')).rejects.toThrow();
  });
});
