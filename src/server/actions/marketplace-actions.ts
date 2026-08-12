'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { action, formToObject, simpleAction, type ActionResult } from './action-result';
import {
  checkoutSchema,
  createDemandSchema,
  createProposalSchema,
  createReviewSchema,
  moderateProductSchema,
  productDraftSchema,
  replyReviewSchema,
  respondProposalSchema,
  toggleFavoriteSchema,
  updateUserStatusSchema,
  grantRoleSchema,
} from '@/lib/validation/schemas';
import { cuid } from '@/lib/validation/common';
import { parsePriceToCents } from '@/lib/money';
import * as products from '@/server/services/product-service';
import * as orders from '@/server/services/order-service';
import * as reviews from '@/server/services/review-service';
import * as demands from '@/server/services/demand-service';
import * as engagement from '@/server/services/engagement-service';
import * as admin from '@/server/services/admin-service';
import { issueDownloadUrl } from '@/server/services/download-service';

/**
 * Marketplace actions.
 *
 * Every action delegates to a service. Nothing here contains business rules —
 * that keeps the same logic reachable from route handlers, jobs and tests
 * without duplicating the authorization checks.
 */

// --- Checkout ---------------------------------------------------------------

export async function startCheckoutAction(
  productId: string
): Promise<ActionResult<orders.CheckoutResult>> {
  return action(checkoutSchema, { productId }, async (input) => {
    const result = await orders.startCheckout(input.productId);
    revalidatePath('/library');
    return result;
  });
}

// --- Downloads --------------------------------------------------------------

export async function requestDownloadAction(
  fileId: string
): Promise<ActionResult<{ url: string }>> {
  return action(z.object({ fileId: cuid }), { fileId }, async (input) => ({
    url: await issueDownloadUrl(input.fileId),
  }));
}

// --- Favorites --------------------------------------------------------------

export async function toggleFavoriteAction(input: {
  productId?: string;
  professionalId?: string;
}): Promise<ActionResult<{ favorited: boolean }>> {
  return action(toggleFavoriteSchema, input, async (parsed) => {
    const result = await engagement.toggleFavorite(parsed);
    revalidatePath('/favorites');
    return result;
  });
}

// --- Reviews ----------------------------------------------------------------

export async function createReviewAction(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const raw = formToObject(formData);

  return action(
    createReviewSchema,
    { ...raw, rating: Number(raw.rating) },
    async (input) => {
      await reviews.createReview(input);
      revalidatePath('/products');
      return null;
    }
  );
}

export async function replyReviewAction(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  return action(replyReviewSchema, formToObject(formData), async (input) => {
    await reviews.replyToReview(input.reviewId, input.body);
    revalidatePath('/dashboard');
    return null;
  });
}

// --- Products ---------------------------------------------------------------

/**
 * Product form input arrives as strings. Prices are parsed from the localised
 * format the user typed ("1.499,90") into cents, and list fields from
 * newline-separated textareas.
 */
function parseProductForm(raw: Record<string, unknown>) {
  const lines = (key: string): string[] =>
    typeof raw[key] === 'string'
      ? raw[key]
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
      : [];

  return {
    name: raw.name,
    tagline: raw.tagline,
    descriptionMd: raw.descriptionMd,
    categoryId: raw.categoryId,
    priceCents:
      typeof raw.price === 'string' ? (parsePriceToCents(raw.price) ?? -1) : -1,
    videoUrl: raw.videoUrl ?? '',
    tags: lines('tags'),
    benefits: lines('benefits'),
    included: lines('included'),
    requirements: lines('requirements'),
    compat: lines('compat'),
    integrations: lines('integrations'),
  };
}

export async function createProductAction(
  _prev: ActionResult<{ slug: string }> | null,
  formData: FormData
): Promise<ActionResult<{ slug: string }>> {
  const raw = formToObject(formData);

  return action(productDraftSchema, parseProductForm(raw), async (input) => {
    const product = await products.createProduct(input);

    // A creator who ticked "submit for review" goes straight into the queue.
    if (raw.submit === 'on' || raw.submit === 'true') {
      await products.submitForReview(product.id);
    }

    revalidatePath('/dashboard/products');
    return { slug: product.slug };
  });
}

export async function updateProductAction(
  productId: string,
  formData: FormData
): Promise<ActionResult<null>> {
  const raw = formToObject(formData);

  return action(
    productDraftSchema.partial(),
    parseProductForm(raw),
    async (input) => {
      await products.updateProduct(productId, input);
      revalidatePath('/dashboard/products');
      return null;
    }
  );
}

export async function submitProductAction(
  productId: string
): Promise<ActionResult<null>> {
  return action(z.object({ productId: cuid }), { productId }, async (input) => {
    await products.submitForReview(input.productId);
    revalidatePath('/dashboard/products');
    return null;
  });
}

export async function archiveProductAction(
  productId: string
): Promise<ActionResult<null>> {
  return action(z.object({ productId: cuid }), { productId }, async (input) => {
    await products.archiveProduct(input.productId);
    revalidatePath('/dashboard/products');
    return null;
  });
}

// --- Demands & proposals ----------------------------------------------------

export async function createDemandAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const raw = formToObject(formData);

  return action(
    createDemandSchema,
    {
      ...raw,
      tools:
        typeof raw.tools === 'string'
          ? raw.tools.split(',').map((t) => t.trim()).filter(Boolean)
          : Array.isArray(raw.tools)
            ? raw.tools
            : [],
      budgetMinCents:
        typeof raw.budgetMin === 'string'
          ? (parsePriceToCents(raw.budgetMin) ?? -1)
          : -1,
      budgetMaxCents:
        typeof raw.budgetMax === 'string'
          ? (parsePriceToCents(raw.budgetMax) ?? -1)
          : -1,
      deadlineWeeks: Number(raw.deadlineWeeks),
    },
    async (input) => {
      const demand = await demands.createDemand(input);
      revalidatePath('/demands');
      return { id: demand.id };
    }
  );
}

export async function createProposalAction(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const raw = formToObject(formData);

  return action(
    createProposalSchema,
    {
      ...raw,
      priceCents:
        typeof raw.price === 'string' ? (parsePriceToCents(raw.price) ?? -1) : -1,
      deliveryWeeks: Number(raw.deliveryWeeks),
      deliverables:
        typeof raw.deliverables === 'string'
          ? raw.deliverables.split('\n').map((l) => l.trim()).filter(Boolean)
          : [],
    },
    async (input) => {
      await demands.createProposal(input);
      revalidatePath(`/demands/${input.demandId}`);
      return null;
    }
  );
}

export async function respondProposalAction(
  proposalId: string,
  decision: 'accept' | 'reject'
): Promise<ActionResult<null>> {
  return action(
    respondProposalSchema,
    { proposalId, decision },
    async (input) => {
      await demands.respondToProposal(input.proposalId, input.decision);
      revalidatePath('/demands');
      return null;
    }
  );
}

export async function withdrawProposalAction(
  proposalId: string
): Promise<ActionResult<null>> {
  return action(z.object({ proposalId: cuid }), { proposalId }, async (input) => {
    await demands.withdrawProposal(input.proposalId);
    revalidatePath('/dashboard');
    return null;
  });
}

// --- Notifications ----------------------------------------------------------

export async function markNotificationsReadAction(
  ids?: string[]
): Promise<ActionResult<null>> {
  return simpleAction(async () => {
    await engagement.markNotificationsRead(ids);
    revalidatePath('/dashboard');
    return null;
  });
}

// --- Admin ------------------------------------------------------------------

export async function moderateProductAction(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  return action(moderateProductSchema, formToObject(formData), async (input) => {
    await products.moderateProduct(input.productId, input.decision, input.reason);
    revalidatePath('/admin/products');
    return null;
  });
}

export async function setUserStatusAction(
  userId: string,
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED',
  reason?: string
): Promise<ActionResult<null>> {
  return action(
    updateUserStatusSchema,
    { userId, status, reason: reason ?? '' },
    async (input) => {
      await admin.setUserStatus(input.userId, input.status, input.reason);
      revalidatePath('/admin/users');
      return null;
    }
  );
}

export async function setUserRoleAction(
  userId: string,
  role: 'BUYER' | 'CREATOR' | 'PROFESSIONAL' | 'ADMIN',
  actionType: 'grant' | 'revoke'
): Promise<ActionResult<null>> {
  return action(
    grantRoleSchema,
    { userId, role, action: actionType },
    async (input) => {
      await admin.setUserRole(input.userId, input.role, input.action);
      revalidatePath('/admin/users');
      return null;
    }
  );
}
