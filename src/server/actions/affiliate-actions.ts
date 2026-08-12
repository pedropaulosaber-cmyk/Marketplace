'use server';

import { revalidatePath } from 'next/cache';
import { action, type ActionResult } from './action-result';
import {
  affiliateDecisionSchema,
  affiliateProgramSchema,
  joinAffiliateSchema,
} from '@/lib/validation/schemas';
import * as affiliates from '@/server/services/affiliate-service';

/**
 * Affiliate programme actions.
 *
 * As elsewhere, these are thin: validate, delegate, revalidate. Every
 * ownership and eligibility rule lives in the service, so the same guarantees
 * hold whether the call arrives from this form, a future API route or a test.
 */

export async function saveAffiliateProgramAction(
  input: unknown
): Promise<ActionResult<{ enabled: boolean }>> {
  return action(affiliateProgramSchema, input, async (data) => {
    const program = await affiliates.saveProgram(data.productId, {
      enabled: data.enabled,
      // The form speaks percent because that is how creators think about
      // commission; storage is basis points so the arithmetic stays integral.
      commissionBps: Math.round(data.commissionPercent * 100),
      cookieDays: data.cookieDays,
      autoApprove: data.autoApprove,
      terms: data.terms ? data.terms : null,
    });

    revalidatePath('/dashboard/affiliate/programs');
    revalidatePath('/dashboard/products');

    return { enabled: program.enabled };
  });
}

export async function joinAffiliateProgramAction(
  input: unknown
): Promise<ActionResult<{ code: string; status: string }>> {
  return action(joinAffiliateSchema, input, async (data) => {
    const affiliate = await affiliates.joinProgram(data.productId);

    revalidatePath('/dashboard/affiliate');

    return { code: affiliate.code, status: affiliate.status };
  });
}

export async function decideAffiliateAction(
  input: unknown
): Promise<ActionResult<void>> {
  return action(affiliateDecisionSchema, input, async (data) => {
    await affiliates.setAffiliateStatus(data.affiliateId, data.status);
    revalidatePath('/dashboard/affiliate/programs');
  });
}
