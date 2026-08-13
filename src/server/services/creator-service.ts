import 'server-only';
import { db, type Prisma } from '@/server/db/client';

/**
 * Founding creators.
 *
 * `isFoundingCreator` is an editorial flag on `Profile` (see the schema
 * comment) — a small, curated list rather than a paginated directory, so
 * there is no filter/sort surface to mirror from the catalog here.
 */

const founderSelect = {
  id: true,
  name: true,
  createdAt: true,
  profile: {
    select: { headline: true, bio: true },
  },
  products: {
    where: { status: 'PUBLISHED', deletedAt: null },
    select: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      priceCents: true,
      ratingSum: true,
      ratingCount: true,
      category: { select: { name: true } },
    },
    orderBy: { salesCount: 'desc' },
    take: 3,
  },
} satisfies Prisma.UserSelect;

export type FoundingCreator = Prisma.UserGetPayload<{
  select: typeof founderSelect;
}>;

/** Oldest account first — founders in the order they actually joined. */
export async function listFoundingCreators(): Promise<FoundingCreator[]> {
  return db.user.findMany({
    where: {
      status: 'ACTIVE',
      deletedAt: null,
      profile: { isFoundingCreator: true },
    },
    select: founderSelect,
    orderBy: { createdAt: 'asc' },
  });
}
