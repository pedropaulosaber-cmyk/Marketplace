import 'server-only';
import { db } from '@/server/db/client';
import { requirePermission, requireUser } from '@/server/auth/rbac';
import { notFound } from '@/lib/errors';

/**
 * Favorites and notifications — lightweight, high-frequency user state.
 */

// --- Favorites --------------------------------------------------------------

/**
 * Toggles a favorite. Returns the resulting state so the UI can reconcile
 * without a second round-trip.
 */
export async function toggleFavorite(input: {
  productId?: string;
  professionalId?: string;
}): Promise<{ favorited: boolean }> {
  const user = await requirePermission('favorite:manage');

  const where = input.productId
    ? { userId_productId: { userId: user.id, productId: input.productId } }
    : {
        userId_professionalId: {
          userId: user.id,
          professionalId: input.professionalId!,
        },
      };

  const existing = await db.favorite.findUnique({
    where,
    select: { id: true },
  });

  if (existing) {
    await db.favorite.delete({ where: { id: existing.id } });
    return { favorited: false };
  }

  // Verify the target exists before creating a dangling favorite.
  if (input.productId) {
    const product = await db.product.findFirst({
      where: { id: input.productId, status: 'PUBLISHED', deletedAt: null },
      select: { id: true },
    });
    if (!product) throw notFound('Produto não encontrado.');
  } else {
    const pro = await db.professionalProfile.findFirst({
      where: { id: input.professionalId, deletedAt: null },
      select: { id: true },
    });
    if (!pro) throw notFound('Profissional não encontrado.');
  }

  await db.favorite.create({
    data: {
      userId: user.id,
      productId: input.productId ?? null,
      professionalId: input.professionalId ?? null,
    },
  });

  return { favorited: true };
}

export async function listFavorites(userId: string) {
  return db.favorite.findMany({
    where: { userId },
    select: {
      id: true,
      createdAt: true,
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          tagline: true,
          priceCents: true,
          ratingSum: true,
          ratingCount: true,
          salesCount: true,
          status: true,
          category: { select: { name: true } },
          author: { select: { name: true } },
          images: {
            select: { storageKey: true, alt: true },
            orderBy: { position: 'asc' },
            take: 1,
          },
        },
      },
      professional: {
        select: {
          id: true,
          slug: true,
          title: true,
          field: true,
          bio: true,
          verified: true,
          rateMinCents: true,
          rateMaxCents: true,
          availability: true,
          ratingSum: true,
          ratingCount: true,
          projectsCount: true,
          skills: true,
          user: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/** Favorited product ids for the current user, for rendering filled hearts. */
export async function getFavoriteProductIds(
  userId: string
): Promise<Set<string>> {
  const rows = await db.favorite.findMany({
    where: { userId, productId: { not: null } },
    select: { productId: true },
  });

  return new Set(rows.map((r) => r.productId!).filter(Boolean));
}

// --- Notifications ----------------------------------------------------------

export async function listNotifications(userId: string, limit = 30) {
  return db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function countUnread(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null } });
}

export async function markNotificationsRead(ids?: string[]): Promise<void> {
  const user = await requireUser();

  await db.notification.updateMany({
    // Always scoped by userId: an id from the client can never reach another
    // user's notification.
    where: {
      userId: user.id,
      readAt: null,
      ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
    },
    data: { readAt: new Date() },
  });
}
