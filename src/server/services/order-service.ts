import 'server-only';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { db, type Prisma } from '@/server/db/client';
import { requirePermission, requireUser } from '@/server/auth/rbac';
import { audit } from '@/server/security/audit';
import { enforceRateLimit } from '@/server/security/rate-limit';
import { conflict, notFound, unavailable, validation } from '@/lib/errors';
import { splitFee } from '@/lib/money';
import { env, isPaymentsConfigured } from '@/lib/env';
import { createPaymentIntent } from '@/server/payments/provider';
import {
  recordCommission,
  resolveAttribution,
  splitAffiliateShare,
} from '@/server/services/affiliate-service';
import { REFERRAL_COOKIE, parseReferralCookie } from '@/lib/affiliate';
import { log } from '@/lib/logger';

const logger = log('orders');

/**
 * Reads the referral cookie and turns it into an attribution, or nothing.
 *
 * Deliberately total: every failure path — absent cookie, tampered value,
 * expired window, revoked affiliate, database hiccup — returns null. An
 * affiliate commission is upside for the seller, and no part of it is worth
 * failing a purchase the buyer is trying to complete.
 */
async function resolveCheckoutAttribution(productId: string, buyerId: string) {
  try {
    const jar = await cookies();
    const parsed = parseReferralCookie(jar.get(REFERRAL_COOKIE)?.value);
    if (!parsed) return null;

    return await resolveAttribution(
      parsed.code,
      parsed.clickedAt,
      productId,
      buyerId
    );
  } catch (error) {
    logger.warn({ err: error }, 'referral attribution failed; selling unattributed');
    return null;
  }
}

/**
 * Order and checkout service.
 *
 * The rules that matter, and why:
 *
 *   * Price is read from the catalog inside the order transaction. The client
 *     sends a product id and nothing else — never an amount.
 *   * An order is created PENDING. It becomes PAID only from a signature-
 *     verified webhook, never from a browser callback.
 *   * Free products settle immediately and grant entitlement without a
 *     provider round-trip.
 *   * Re-buying an owned product is refused rather than silently charged.
 */

/** Human-facing order reference, e.g. "AUT-8F3K2Q". */
function orderNumber(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = randomBytes(6);
  let out = '';
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return `AUT-${out}`;
}

export interface CheckoutResult {
  orderId: string;
  orderNumber: string;
  status: 'paid' | 'requires_payment';
  /** Present only when a provider payment is required. */
  clientSecret?: string;
}

/**
 * Creates an order for a single product and, when payment is due, a matching
 * PaymentIntent.
 */
export async function startCheckout(productId: string): Promise<CheckoutResult> {
  const user = await requirePermission('order:create');
  await enforceRateLimit('checkout', user.id);

  // Authoritative read: status, price and author all come from the database.
  const product = await db.product.findFirst({
    where: { id: productId, status: 'PUBLISHED', deletedAt: null },
    select: {
      id: true,
      name: true,
      priceCents: true,
      currency: true,
      authorId: true,
    },
  });

  // A draft, archived or non-existent product is not purchasable, and the
  // error does not distinguish the cases.
  if (!product) throw notFound('Este produto não está disponível.');

  if (product.authorId === user.id) {
    throw validation('Você não pode comprar o seu próprio produto.');
  }

  // Entitlement is permanent, so a second purchase would be pure loss to the
  // buyer. Send them to their library instead.
  const owned = await hasPurchased(user.id, productId);
  if (owned) {
    throw conflict('Você já tem este produto na sua biblioteca.');
  }

  const { feeCents, sellerCents: grossSellerCents } = splitFee(
    product.priceCents,
    env.PLATFORM_FEE_BPS
  );

  // Referral attribution. Resolved once, here, and then frozen onto the order
  // line — the commission a buyer's link earned must not change later because
  // the creator edited the rate or revoked the affiliate.
  const attribution = await resolveCheckoutAttribution(product.id, user.id);

  const { affiliateCents, sellerCents } = attribution
    ? splitAffiliateShare(
        grossSellerCents,
        attribution.commissionBps,
        product.priceCents
      )
    : { affiliateCents: 0, sellerCents: grossSellerCents };

  const isFree = product.priceCents === 0;

  // A paid checkout with no configured provider must fail loudly. Creating a
  // "paid" order here would hand over the deliverable for nothing.
  if (!isFree && !isPaymentsConfigured) {
    throw unavailable(
      'Pagamentos ainda não estão disponíveis. Tente novamente mais tarde.'
    );
  }

  const order = await db.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        number: orderNumber(),
        buyerId: user.id,
        status: isFree ? 'PAID' : 'PENDING',
        subtotalCents: product.priceCents,
        feeCents,
        totalCents: product.priceCents,
        currency: product.currency,
        ...(isFree ? { paidAt: new Date() } : {}),
        items: {
          create: {
            productId: product.id,
            // Snapshot: history must not change when the seller edits the
            // product or its price later.
            productName: product.name,
            unitCents: product.priceCents,
            quantity: 1,
            feeCents,
            sellerCents,
            sellerId: product.authorId,
            affiliateId: attribution?.affiliateId ?? null,
            affiliateCents,
          },
        },
      },
      select: { id: true, number: true },
    });

    if (isFree) {
      await settleOrderEffects(tx, created.id);
    }

    await audit(
      {
        actorId: user.id,
        action: 'order.created',
        entityType: 'Order',
        entityId: created.id,
        metadata: {
          productId: product.id,
          totalCents: product.priceCents,
          free: isFree,
        },
      },
      tx
    );

    return created;
  });

  if (isFree) {
    return {
      orderId: order.id,
      orderNumber: order.number,
      status: 'paid',
    };
  }

  const intent = await createPaymentIntent({
    orderId: order.id,
    orderNumber: order.number,
    amountCents: product.priceCents,
    currency: product.currency,
    buyerEmail: user.email,
    feeCents,
  });

  await db.payment.create({
    data: {
      orderId: order.id,
      provider: 'stripe',
      providerRef: intent.id,
      status: 'PROCESSING',
      amountCents: product.priceCents,
      currency: product.currency,
    },
  });

  return {
    orderId: order.id,
    orderNumber: order.number,
    status: 'requires_payment',
    clientSecret: intent.clientSecret,
  };
}

/**
 * Side effects of a settled order: sales counters, seller payout, and the
 * notifications both parties expect.
 *
 * Runs inside the caller's transaction so an order can never be marked paid
 * without its ledger entries.
 */
export async function settleOrderEffects(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<void> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      number: true,
      buyerId: true,
      items: {
        select: {
          id: true,
          productId: true,
          productName: true,
          sellerId: true,
          sellerCents: true,
          affiliateId: true,
          affiliateCents: true,
        },
      },
    },
  });

  if (!order) return;

  for (const item of order.items) {
    await tx.product.update({
      where: { id: item.productId },
      data: { salesCount: { increment: 1 } },
    });

    // Commission is written in the same transaction as the payout, from the
    // attribution frozen at checkout. Keyed to the order line, so a replayed
    // webhook settles it once.
    if (item.affiliateId && item.affiliateCents > 0) {
      const commission = await recordCommission(tx, {
        affiliateId: item.affiliateId,
        orderItemId: item.id,
        amountCents: item.affiliateCents,
      });

      if (commission) {
        await tx.notification.create({
          data: {
            userId: commission.affiliateUserId,
            type: 'SALE_COMPLETED',
            title: 'Comissão de afiliado registrada',
            body: `Uma venda de ${item.productName} foi atribuída ao seu link.`,
            href: '/dashboard/affiliate',
          },
        });
      }
    }

    // Seller earnings settle D+15, matching the published commission terms.
    if (item.sellerCents > 0) {
      const scheduledFor = new Date();
      scheduledFor.setDate(scheduledFor.getDate() + 15);

      await tx.payout.create({
        data: {
          sellerId: item.sellerId,
          amountCents: item.sellerCents,
          status: 'SCHEDULED',
          scheduledFor,
          reference: order.number,
        },
      });
    }

    await tx.notification.create({
      data: {
        userId: item.sellerId,
        type: 'SALE_COMPLETED',
        title: 'Você fez uma venda',
        body: `${item.productName} foi comprado. Pedido ${order.number}.`,
        href: '/dashboard/orders',
      },
    });
  }

  await tx.notification.create({
    data: {
      userId: order.buyerId,
      type: 'PURCHASE_COMPLETED',
      title: 'Compra confirmada',
      body: `Pedido ${order.number} liberado na sua biblioteca.`,
      href: '/library',
    },
  });
}

/**
 * Marks an order paid. Called *only* from the verified webhook handler.
 *
 * Idempotent: a repeated delivery of the same event finds the order already
 * PAID and returns without double-crediting anyone.
 */
export async function markOrderPaid(
  tx: Prisma.TransactionClient,
  orderId: string,
  providerRef: string
): Promise<boolean> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, totalCents: true },
  });

  if (!order) {
    logger.warn({ orderId, providerRef }, 'webhook referenced unknown order');
    return false;
  }

  if (order.status === 'PAID') return false; // already settled

  await tx.order.update({
    where: { id: orderId },
    data: { status: 'PAID', paidAt: new Date() },
  });

  await tx.payment.updateMany({
    where: { orderId, providerRef },
    data: { status: 'SUCCEEDED' },
  });

  await settleOrderEffects(tx, orderId);

  return true;
}

export async function markOrderFailed(
  tx: Prisma.TransactionClient,
  orderId: string,
  providerRef: string,
  reason: string
): Promise<void> {
  await tx.order.updateMany({
    where: { id: orderId, status: 'PENDING' },
    data: { status: 'FAILED' },
  });

  await tx.payment.updateMany({
    where: { orderId, providerRef },
    data: { status: 'FAILED', failureReason: reason.slice(0, 300) },
  });
}

/**
 * Entitlement check — the single source of truth for "may this user download
 * this product?". Used by the library, the download endpoint and checkout.
 */
export async function hasPurchased(
  userId: string,
  productId: string
): Promise<boolean> {
  const item = await db.orderItem.findFirst({
    where: {
      productId,
      order: { buyerId: userId, status: 'PAID' },
    },
    select: { id: true },
  });

  return item !== null;
}

/** The buyer's library: everything they have paid for. */
export async function listLibrary(userId: string) {
  return db.orderItem.findMany({
    where: { order: { buyerId: userId, status: 'PAID' } },
    select: {
      id: true,
      productName: true,
      unitCents: true,
      order: { select: { number: true, paidAt: true } },
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          tagline: true,
          deletedAt: true,
          category: { select: { name: true } },
          author: { select: { name: true } },
          images: {
            select: { storageKey: true, alt: true },
            orderBy: { position: 'asc' },
            take: 1,
          },
          files: {
            where: { deletedAt: null },
            select: {
              id: true,
              fileName: true,
              sizeBytes: true,
              version: true,
              createdAt: true,
            },
          },
        },
      },
    },
    orderBy: { order: { paidAt: 'desc' } },
  });
}

/** Orders placed by the current user. */
export async function listOwnOrders(userId: string) {
  return db.order.findMany({
    where: { buyerId: userId },
    select: {
      id: true,
      number: true,
      status: true,
      totalCents: true,
      placedAt: true,
      paidAt: true,
      items: { select: { productName: true, unitCents: true } },
    },
    orderBy: { placedAt: 'desc' },
    take: 50,
  });
}

/** Sales made by the current seller. Scoped to their own items only. */
export async function listSellerOrders(sellerId: string) {
  return db.orderItem.findMany({
    where: { sellerId, order: { status: 'PAID' } },
    select: {
      id: true,
      productName: true,
      unitCents: true,
      feeCents: true,
      sellerCents: true,
      createdAt: true,
      order: {
        select: {
          number: true,
          paidAt: true,
          buyer: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

/** Order detail, readable only by its buyer (or an admin). */
export async function getOwnOrder(orderId: string) {
  const user = await requireUser();

  const order = await db.order.findFirst({
    // Scoping the query by buyerId is what prevents IDOR: a wrong id simply
    // returns nothing rather than another buyer's order.
    where: {
      id: orderId,
      ...(user.roles.includes('ADMIN') ? {} : { buyerId: user.id }),
    },
    include: {
      items: {
        include: {
          product: { select: { slug: true, name: true } },
        },
      },
      payment: { select: { status: true, provider: true } },
    },
  });

  if (!order) throw notFound('Pedido não encontrado.');
  return order;
}
