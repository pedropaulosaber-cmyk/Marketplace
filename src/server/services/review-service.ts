import 'server-only';
import { db } from '@/server/db/client';
import { assertOwnership, requirePermission } from '@/server/auth/rbac';
import { audit } from '@/server/security/audit';
import { enforceRateLimit } from '@/server/security/rate-limit';
import { conflict, forbidden, notFound } from '@/lib/errors';

/**
 * Reviews.
 *
 * A review is only meaningful if it comes from a real buyer, so the paid order
 * that entitles it is stored on the row itself. The schema's unique constraint
 * on (productId, authorId) makes duplicates impossible even under a race.
 */

export async function createReview(input: {
  productId: string;
  rating: number;
  comment: string;
}): Promise<void> {
  const user = await requirePermission('review:create');
  await enforceRateLimit('review', user.id);

  // Entitlement: find the paid order that contains this product.
  const orderItem = await db.orderItem.findFirst({
    where: {
      productId: input.productId,
      order: { buyerId: user.id, status: 'PAID' },
    },
    select: { orderId: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!orderItem) {
    throw forbidden('Somente quem comprou este produto pode avaliá-lo.');
  }

  const existing = await db.review.findUnique({
    where: {
      productId_authorId: { productId: input.productId, authorId: user.id },
    },
    select: { id: true },
  });

  if (existing) throw conflict('Você já avaliou este produto.');

  await db.$transaction(async (tx) => {
    await tx.review.create({
      data: {
        productId: input.productId,
        authorId: user.id,
        orderId: orderItem.orderId,
        rating: input.rating,
        comment: input.comment,
      },
    });

    // Aggregates are updated in the same transaction as the review, so a
    // listing never shows a count that disagrees with the reviews on the page.
    const product = await tx.product.update({
      where: { id: input.productId },
      data: {
        ratingSum: { increment: input.rating },
        ratingCount: { increment: 1 },
      },
      select: { authorId: true, name: true, slug: true },
    });

    await tx.notification.create({
      data: {
        userId: product.authorId,
        type: 'REVIEW_RECEIVED',
        title: 'Nova avaliação',
        body: `${product.name} recebeu uma avaliação de ${input.rating} estrelas.`,
        href: `/products/${product.slug}`,
      },
    });

    await audit(
      {
        actorId: user.id,
        action: 'review.created',
        entityType: 'Product',
        entityId: input.productId,
        metadata: { rating: input.rating },
      },
      tx
    );
  });
}

/** The product's creator may reply once to each review. */
export async function replyToReview(
  reviewId: string,
  body: string
): Promise<void> {
  const user = await requirePermission('review:reply');

  const review = await db.review.findFirst({
    where: { id: reviewId, deletedAt: null },
    select: {
      id: true,
      product: { select: { authorId: true } },
      reply: { select: { id: true } },
    },
  });

  if (!review) throw notFound('Avaliação não encontrada.');

  // Only the product's author replies as the creator.
  assertOwnership(user, review.product.authorId, {
    entityType: 'Review',
    entityId: reviewId,
  });

  if (review.reply) throw conflict('Você já respondeu esta avaliação.');

  await db.$transaction(async (tx) => {
    await tx.reviewReply.create({
      data: { reviewId, authorId: user.id, body },
    });

    await audit(
      {
        actorId: user.id,
        action: 'review.replied',
        entityType: 'Review',
        entityId: reviewId,
      },
      tx
    );
  });
}

/** Admin removal of an abusive review. Soft delete keeps the audit trail. */
export async function removeReview(
  reviewId: string,
  reason: string
): Promise<void> {
  const admin = await requirePermission('review:moderate');

  const review = await db.review.findFirst({
    where: { id: reviewId, deletedAt: null },
    select: { id: true, rating: true, productId: true },
  });

  if (!review) throw notFound('Avaliação não encontrada.');

  await db.$transaction(async (tx) => {
    await tx.review.update({
      where: { id: reviewId },
      data: { deletedAt: new Date() },
    });

    // Removing the review must also remove its weight from the average.
    await tx.product.update({
      where: { id: review.productId },
      data: {
        ratingSum: { decrement: review.rating },
        ratingCount: { decrement: 1 },
      },
    });

    await audit(
      {
        actorId: admin.id,
        action: 'review.removed',
        entityType: 'Review',
        entityId: reviewId,
        metadata: { reason },
      },
      tx
    );
  });
}

/** Whether the current user may review a product, for CTA rendering. */
export async function canReview(
  userId: string,
  productId: string
): Promise<boolean> {
  const [purchased, reviewed] = await Promise.all([
    db.orderItem.findFirst({
      where: { productId, order: { buyerId: userId, status: 'PAID' } },
      select: { id: true },
    }),
    db.review.findUnique({
      where: { productId_authorId: { productId, authorId: userId } },
      select: { id: true },
    }),
  ]);

  return purchased !== null && reviewed === null;
}
