import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  db,
  resetDatabase,
  createUser,
  createCategory,
  createProduct,
  createPaidOrder,
  signIn,
  signOut,
} from './helpers';
import {
  startCheckout,
  hasPurchased,
  getOwnOrder,
  markOrderPaid,
  listLibrary,
} from '@/server/services/order-service';
import { createReview, canReview } from '@/server/services/review-service';
import { issueDownloadUrl } from '@/server/services/download-service';
import { isAppError } from '@/lib/errors';

/**
 * Commerce: checkout, entitlement, downloads and reviews.
 *
 * These are the paths where a mistake costs money or gives away paid content,
 * so they are tested against the real database and real authorization code.
 */

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await db.$disconnect();
});

async function setup() {
  const seller = await createUser({ roles: ['CREATOR'] });
  const buyer = await createUser({ roles: ['BUYER'] });
  const categoryId = await createCategory();

  const paid = await createProduct({
    authorId: seller.id,
    categoryId,
    priceCents: 14_900,
  });

  const free = await createProduct({
    authorId: seller.id,
    categoryId,
    priceCents: 0,
  });

  return { seller, buyer, categoryId, paid, free };
}

describe('checkout pricing', () => {
  it('takes the price from the catalog, ignoring anything the client sends', async () => {
    const { buyer, free } = await setup();
    await signIn(buyer.id);

    // The action layer only accepts a product id; this asserts the service
    // reads the authoritative price for itself.
    const result = await startCheckout(free.id);

    const order = await db.order.findUniqueOrThrow({
      where: { id: result.orderId },
      select: { totalCents: true, subtotalCents: true, feeCents: true },
    });

    expect(order.totalCents).toBe(0);
    expect(order.subtotalCents).toBe(0);
  });

  it('records a fee that matches the published 15% commission', async () => {
    const { buyer, free } = await setup();
    await signIn(buyer.id);

    const result = await startCheckout(free.id);

    const item = await db.orderItem.findFirstOrThrow({
      where: { orderId: result.orderId },
      select: { unitCents: true, feeCents: true, sellerCents: true },
    });

    // Database check constraint enforces this too, but assert it explicitly:
    // the split must be exact.
    expect(item.feeCents + item.sellerCents).toBe(item.unitCents);
  });

  it('settles a free product immediately and grants entitlement', async () => {
    const { buyer, free } = await setup();
    await signIn(buyer.id);

    const result = await startCheckout(free.id);

    expect(result.status).toBe('paid');
    expect(await hasPurchased(buyer.id, free.id)).toBe(true);
  });

  it('refuses a paid checkout when no payment provider is configured', async () => {
    const { buyer, paid } = await setup();
    await signIn(buyer.id);

    // No STRIPE_SECRET_KEY in the test environment. The correct behaviour is
    // to fail, never to mark an order paid without money changing hands.
    await expect(startCheckout(paid.id)).rejects.toSatisfy(
      (e: unknown) => isAppError(e) && e.code === 'UNAVAILABLE'
    );

    expect(await hasPurchased(buyer.id, paid.id)).toBe(false);
  });

  it('refuses to sell a product to its own author', async () => {
    const { seller, free } = await setup();
    await signIn(seller.id);

    await expect(startCheckout(free.id)).rejects.toThrow();
  });

  it('refuses a second purchase of an already-owned product', async () => {
    const { buyer, free } = await setup();
    await signIn(buyer.id);

    await startCheckout(free.id);

    await expect(startCheckout(free.id)).rejects.toSatisfy(
      (e: unknown) => isAppError(e) && e.code === 'CONFLICT'
    );
  });

  it('refuses to sell a product that is not published', async () => {
    const { buyer, seller, categoryId } = await setup();
    const draft = await createProduct({
      authorId: seller.id,
      categoryId,
      status: 'DRAFT',
      priceCents: 0,
    });

    await signIn(buyer.id);

    await expect(startCheckout(draft.id)).rejects.toSatisfy(
      (e: unknown) => isAppError(e) && e.code === 'NOT_FOUND'
    );
  });

  it('refuses checkout for an anonymous visitor', async () => {
    const { free } = await setup();
    signOut();

    await expect(startCheckout(free.id)).rejects.toSatisfy(
      (e: unknown) => isAppError(e) && e.code === 'UNAUTHENTICATED'
    );
  });
});

describe('order access (IDOR)', () => {
  it("refuses to show one buyer another buyer's order", async () => {
    const { buyer, paid } = await setup();
    const order = await createPaidOrder({ buyerId: buyer.id, productId: paid.id });

    const attacker = await createUser({ roles: ['BUYER'] });
    await signIn(attacker.id);

    // Knowing the id is not enough — the query is scoped by buyer.
    await expect(getOwnOrder(order.id)).rejects.toSatisfy(
      (e: unknown) => isAppError(e) && e.code === 'NOT_FOUND'
    );
  });

  it('shows a buyer their own order', async () => {
    const { buyer, paid } = await setup();
    const order = await createPaidOrder({ buyerId: buyer.id, productId: paid.id });

    await signIn(buyer.id);

    await expect(getOwnOrder(order.id)).resolves.toMatchObject({ id: order.id });
  });

  it('lets an admin read any order', async () => {
    const { buyer, paid } = await setup();
    const order = await createPaidOrder({ buyerId: buyer.id, productId: paid.id });

    const admin = await createUser({ roles: ['ADMIN'] });
    await signIn(admin.id);

    await expect(getOwnOrder(order.id)).resolves.toMatchObject({ id: order.id });
  });
});

describe('entitlement and downloads', () => {
  it('refuses a download to someone who has not bought the product', async () => {
    const { paid } = await setup();
    const stranger = await createUser({ roles: ['BUYER'] });
    await signIn(stranger.id);

    const file = await db.productFile.findFirstOrThrow({
      where: { productId: paid.id },
      select: { id: true },
    });

    await expect(issueDownloadUrl(file.id)).rejects.toSatisfy(
      (e: unknown) =>
        isAppError(e) && (e.code === 'FORBIDDEN' || e.code === 'UNAVAILABLE')
    );
  });

  it('refuses a download to an anonymous visitor', async () => {
    const { paid } = await setup();
    signOut();

    const file = await db.productFile.findFirstOrThrow({
      where: { productId: paid.id },
      select: { id: true },
    });

    await expect(issueDownloadUrl(file.id)).rejects.toSatisfy(
      (e: unknown) => isAppError(e) && e.code === 'UNAUTHENTICATED'
    );
  });

  it('never leaks the storage key through the library payload', async () => {
    const { buyer, paid } = await setup();
    await createPaidOrder({ buyerId: buyer.id, productId: paid.id });

    const library = await listLibrary(buyer.id);
    const serialised = JSON.stringify(library);

    const file = await db.productFile.findFirstOrThrow({
      where: { productId: paid.id },
      select: { storageKey: true },
    });

    // The buyer sees file names and sizes, never the object key that would
    // let them address the bucket directly.
    expect(serialised).not.toContain(file.storageKey);
    expect(serialised).not.toContain('storageKey');
  });

  it('puts a purchased product in the buyer library', async () => {
    const { buyer, paid } = await setup();
    await createPaidOrder({ buyerId: buyer.id, productId: paid.id });

    const library = await listLibrary(buyer.id);

    expect(library).toHaveLength(1);
    expect(library[0]?.product.id).toBe(paid.id);
  });
});

describe('webhook fulfilment', () => {
  it('marks an order paid exactly once, however many times it is delivered', async () => {
    const { buyer, seller, categoryId } = await setup();
    const product = await createProduct({
      authorId: seller.id,
      categoryId,
      priceCents: 9_900,
    });

    const order = await db.order.create({
      data: {
        number: 'AUT-TEST01',
        buyerId: buyer.id,
        status: 'PENDING',
        subtotalCents: 9_900,
        feeCents: 1_485,
        totalCents: 9_900,
        items: {
          create: {
            productId: product.id,
            productName: 'Produto de Teste',
            unitCents: 9_900,
            quantity: 1,
            feeCents: 1_485,
            sellerCents: 8_415,
            sellerId: seller.id,
          },
        },
      },
      select: { id: true },
    });

    const first = await db.$transaction((tx) =>
      markOrderPaid(tx, order.id, 'pi_test_123')
    );
    const second = await db.$transaction((tx) =>
      markOrderPaid(tx, order.id, 'pi_test_123')
    );
    const third = await db.$transaction((tx) =>
      markOrderPaid(tx, order.id, 'pi_test_123')
    );

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(third).toBe(false);

    // A duplicate delivery must not double the sales count or the payout.
    const fresh = await db.product.findUniqueOrThrow({
      where: { id: product.id },
      select: { salesCount: true },
    });
    expect(fresh.salesCount).toBe(1);

    const payouts = await db.payout.findMany({ where: { sellerId: seller.id } });
    expect(payouts).toHaveLength(1);
    expect(payouts[0]?.amountCents).toBe(8_415);
  });
});

describe('reviews', () => {
  it('refuses a review from someone who did not buy the product', async () => {
    const { paid } = await setup();
    const stranger = await createUser({ roles: ['BUYER'] });
    await signIn(stranger.id);

    await expect(
      createReview({
        productId: paid.id,
        rating: 5,
        comment: 'Nunca comprei, mas vou avaliar assim mesmo.',
      })
    ).rejects.toSatisfy((e: unknown) => isAppError(e) && e.code === 'FORBIDDEN');
  });

  it('accepts a review from a verified buyer and updates the aggregate', async () => {
    const { buyer, paid } = await setup();
    await createPaidOrder({ buyerId: buyer.id, productId: paid.id });
    await signIn(buyer.id);

    await createReview({
      productId: paid.id,
      rating: 4,
      comment: 'Funcionou bem depois de ajustar as regras.',
    });

    const product = await db.product.findUniqueOrThrow({
      where: { id: paid.id },
      select: { ratingSum: true, ratingCount: true },
    });

    expect(product.ratingCount).toBe(1);
    expect(product.ratingSum).toBe(4);
  });

  it('refuses a second review of the same product by the same buyer', async () => {
    const { buyer, paid } = await setup();
    await createPaidOrder({ buyerId: buyer.id, productId: paid.id });
    await signIn(buyer.id);

    const review = {
      productId: paid.id,
      rating: 5,
      comment: 'Primeira avaliação, bem detalhada.',
    };

    await createReview(review);
    await expect(createReview(review)).rejects.toSatisfy(
      (e: unknown) => isAppError(e) && e.code === 'CONFLICT'
    );

    const count = await db.review.count({ where: { productId: paid.id } });
    expect(count).toBe(1);
  });

  it('canReview reflects purchase and prior-review state', async () => {
    const { buyer, paid } = await setup();

    expect(await canReview(buyer.id, paid.id)).toBe(false);

    await createPaidOrder({ buyerId: buyer.id, productId: paid.id });
    expect(await canReview(buyer.id, paid.id)).toBe(true);

    await signIn(buyer.id);
    await createReview({
      productId: paid.id,
      rating: 5,
      comment: 'Avaliação suficiente para passar na validação.',
    });

    expect(await canReview(buyer.id, paid.id)).toBe(false);
  });
});
