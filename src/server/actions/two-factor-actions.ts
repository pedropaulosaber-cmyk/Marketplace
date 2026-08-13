'use server';

import { revalidatePath } from 'next/cache';
import { action, simpleAction, type ActionResult } from './action-result';
import {
  disableTwoFactorSchema,
  twoFactorCodeSchema,
} from '@/lib/validation/schemas';
import * as twoFactor from '@/server/services/two-factor-service';

/**
 * Two-factor actions.
 *
 * Note what is not here: no action returns the stored TOTP secret, and none
 * accepts a user id. Enrolment always acts on the caller's own account, taken
 * from the session, so there is no parameter an attacker could point at
 * somebody else's second factor.
 */

export async function beginEnrolmentAction(): Promise<
  ActionResult<{ secret: string; uri: string }>
> {
  return simpleAction(async () => twoFactor.beginTotpEnrolment());
}

export async function confirmEnrolmentAction(
  input: unknown
): Promise<ActionResult<{ recoveryCodes: string[] }>> {
  return action(twoFactorCodeSchema, input, async (data) => {
    const recoveryCodes = await twoFactor.confirmTotpEnrolment(data.code);
    revalidatePath('/dashboard/settings');
    return { recoveryCodes };
  });
}

export async function disableTwoFactorAction(
  input: unknown
): Promise<ActionResult<void>> {
  return action(disableTwoFactorSchema, input, async (data) => {
    await twoFactor.disableTwoFactor(data.password);
    revalidatePath('/dashboard/settings');
  });
}

/**
 * Completes the login challenge.
 *
 * Redirect is left to the caller rather than done here: `redirect` throws a
 * control-flow signal, and swallowing it inside the action wrapper's error
 * handling would turn a successful login into a reported failure.
 */
export async function completeChallengeAction(
  input: unknown
): Promise<ActionResult<void>> {
  return action(twoFactorCodeSchema, input, async (data) => {
    await twoFactor.completeChallenge(data.code);
  });
}
