'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { action, formToObject, type ActionResult } from './action-result';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from '@/lib/validation/schemas';
import * as authService from '@/server/services/auth-service';
import { destroySession } from '@/server/auth/session';
import { requireUser } from '@/server/auth/rbac';
import { db } from '@/server/db/client';
import { audit } from '@/server/security/audit';

/**
 * Authentication actions.
 *
 * Server Actions are POST-only and Next.js verifies the Origin header against
 * the deployment host, which is what protects them from cross-site submission.
 * Session cookies are additionally SameSite=Lax.
 */

/** Only same-origin, relative paths are accepted as a post-login redirect. */
function safeRedirect(next: unknown, fallback: string): string {
  if (typeof next !== 'string' || next === '') return fallback;
  // Reject absolute URLs and protocol-relative paths — an open redirect is a
  // phishing primitive.
  if (!next.startsWith('/') || next.startsWith('//')) return fallback;
  return next;
}

export async function loginAction(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const raw = formToObject(formData);

  const result = await action(loginSchema, raw, async (input) => {
    await authService.login(input);
    return null;
  });

  if (result.ok) {
    redirect(safeRedirect(raw.next, '/dashboard'));
  }

  return result;
}

export async function registerAction(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const raw = formToObject(formData);

  const result = await action(
    registerSchema,
    { ...raw, acceptTerms: raw.acceptTerms === 'on' || raw.acceptTerms === 'true' },
    async (input) => {
      await authService.register(input);
      return null;
    }
  );

  if (result.ok) {
    // Sellers land on their dashboard, buyers in the catalog — the next step
    // each of them actually came for.
    const intent = typeof raw.intent === 'string' ? raw.intent : 'buy';
    redirect(intent === 'buy' ? '/products' : '/dashboard');
  }

  return result;
}

export async function logoutAction(): Promise<void> {
  const user = await requireUser().catch(() => null);

  await destroySession();

  if (user) {
    await audit({
      actorId: user.id,
      action: 'user.logout',
      entityType: 'User',
      entityId: user.id,
    });
  }

  redirect('/');
}

export async function changePasswordAction(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  return action(changePasswordSchema, formToObject(formData), async (input) => {
    const user = await requireUser();
    await authService.changePassword(user.id, input);
    // Sessions were revoked, so the user must sign in again.
    redirect('/login?reason=password-changed');
  });
}

export async function updateProfileAction(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  return action(updateProfileSchema, formToObject(formData), async (input) => {
    const user = await requireUser();

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { name: input.name },
      });

      await tx.profile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          headline: input.headline || null,
          bio: input.bio || null,
          company: input.company || null,
          website: input.website || null,
          location: input.location || null,
        },
        update: {
          headline: input.headline || null,
          bio: input.bio || null,
          company: input.company || null,
          website: input.website || null,
          location: input.location || null,
        },
      });
    });

    revalidatePath('/dashboard/profile');
    return null;
  });
}
