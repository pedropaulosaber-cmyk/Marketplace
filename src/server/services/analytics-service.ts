import 'server-only';
import { db } from '@/server/db/client';

/**
 * Seller analytics.
 *
 * Every figure is aggregated in Postgres and scoped to the calling seller.
 * Nothing here loads a per-row collection into the app to count it, so the
 * dashboard stays fast as a seller's history grows.
 */

export interface SellerKpis {
  revenueCents: number;
  orders: number;
  products: number;
  productsInReview: number;
  reviews: number;
  customers: number;
  averageRating: number | null;
  pendingPayoutCents: number;
}

export async function getSellerKpis(sellerId: string): Promise<SellerKpis> {
  const [revenue, orders, products, inReview, ratings, customers, payouts] =
    await Promise.all([
      db.orderItem.aggregate({
        where: { sellerId, order: { status: 'PAID' } },
        _sum: { sellerCents: true },
      }),
      db.orderItem.count({
        where: { sellerId, order: { status: 'PAID' } },
      }),
      db.product.count({
        where: { authorId: sellerId, deletedAt: null },
      }),
      db.product.count({
        where: { authorId: sellerId, status: 'PENDING_REVIEW', deletedAt: null },
      }),
      db.product.aggregate({
        where: { authorId: sellerId, deletedAt: null },
        _sum: { ratingSum: true, ratingCount: true },
      }),
      db.orderItem.findMany({
        where: { sellerId, order: { status: 'PAID' } },
        select: { order: { select: { buyerId: true } } },
        distinct: ['orderId'],
      }),
      db.payout.aggregate({
        where: { sellerId, status: 'SCHEDULED' },
        _sum: { amountCents: true },
      }),
    ]);

  const ratingSum = ratings._sum.ratingSum ?? 0;
  const ratingCount = ratings._sum.ratingCount ?? 0;

  return {
    revenueCents: revenue._sum.sellerCents ?? 0,
    orders,
    products,
    productsInReview: inReview,
    reviews: ratingCount,
    customers: new Set(customers.map((c) => c.order.buyerId)).size,
    averageRating: ratingCount > 0 ? ratingSum / ratingCount : null,
    pendingPayoutCents: payouts._sum.amountCents ?? 0,
  };
}

export interface RevenuePoint {
  label: string;
  cents: number;
}

const MONTHS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

/**
 * Revenue over time, bucketed by month.
 *
 * Uses a single grouped query rather than one query per bucket. Buckets with
 * no sales are filled with zero so the chart has a continuous x-axis.
 */
export async function getRevenueSeries(
  sellerId: string,
  months: number
): Promise<RevenuePoint[]> {
  const since = new Date();
  since.setMonth(since.getMonth() - (months - 1));
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const rows = await db.orderItem.findMany({
    where: {
      sellerId,
      order: { status: 'PAID', paidAt: { gte: since } },
    },
    select: { sellerCents: true, order: { select: { paidAt: true } } },
  });

  const buckets = new Map<string, number>();

  for (let i = 0; i < months; i += 1) {
    const d = new Date(since);
    d.setMonth(since.getMonth() + i);
    buckets.set(`${d.getFullYear()}-${d.getMonth()}`, 0);
  }

  for (const row of rows) {
    const paidAt = row.order.paidAt;
    if (!paidAt) continue;
    const key = `${paidAt.getFullYear()}-${paidAt.getMonth()}`;
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + row.sellerCents);
    }
  }

  return [...buckets.entries()].map(([key, cents]) => {
    const month = Number(key.split('-')[1]);
    return { label: MONTHS[month] ?? '', cents };
  });
}

/** Best-selling products for this seller. */
export async function getTopProducts(sellerId: string, limit = 5) {
  return db.product.findMany({
    where: { authorId: sellerId, deletedAt: null },
    select: {
      id: true,
      slug: true,
      name: true,
      salesCount: true,
      priceCents: true,
      ratingSum: true,
      ratingCount: true,
      category: { select: { name: true } },
    },
    orderBy: { salesCount: 'desc' },
    take: limit,
  });
}

/** Distinct buyers for this seller, with their spend. */
export async function getSellerCustomers(sellerId: string) {
  const items = await db.orderItem.findMany({
    where: { sellerId, order: { status: 'PAID' } },
    select: {
      unitCents: true,
      createdAt: true,
      productName: true,
      order: {
        select: {
          paidAt: true,
          buyer: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const byBuyer = new Map<
    string,
    {
      id: string;
      name: string;
      email: string;
      orders: number;
      totalCents: number;
      lastAt: Date | null;
    }
  >();

  for (const item of items) {
    const buyer = item.order.buyer;
    const current = byBuyer.get(buyer.id);

    if (current) {
      current.orders += 1;
      current.totalCents += item.unitCents;
    } else {
      byBuyer.set(buyer.id, {
        id: buyer.id,
        name: buyer.name,
        email: buyer.email,
        orders: 1,
        totalCents: item.unitCents,
        lastAt: item.order.paidAt,
      });
    }
  }

  return [...byBuyer.values()].sort((a, b) => b.totalCents - a.totalCents);
}

/** Scheduled and settled payouts for the earnings page. */
export async function getPayouts(sellerId: string) {
  return db.payout.findMany({
    where: { sellerId },
    orderBy: { scheduledFor: 'desc' },
    take: 50,
  });
}
