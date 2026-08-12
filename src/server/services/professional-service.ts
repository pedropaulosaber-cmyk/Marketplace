import 'server-only';
import { db, type Prisma } from '@/server/db/client';
import type { ProfessionalFilters } from '@/lib/validation/schemas';

/**
 * Professional directory.
 *
 * Mirrors the catalog's approach: server-side filtering, sorting and
 * pagination against indexed columns, selecting only what a card renders.
 */

export const PRO_PAGE_SIZE = 9;

const cardSelect = {
  id: true,
  slug: true,
  title: true,
  field: true,
  bio: true,
  location: true,
  skills: true,
  rateMinCents: true,
  rateMaxCents: true,
  availability: true,
  verified: true,
  ratingSum: true,
  ratingCount: true,
  projectsCount: true,
  user: { select: { id: true, name: true } },
} satisfies Prisma.ProfessionalProfileSelect;

export type ProfessionalCard = Prisma.ProfessionalProfileGetPayload<{
  select: typeof cardSelect;
}>;

/** Project-size bands shown as filters, in cents. */
const TIER_RANGES: Record<string, Prisma.ProfessionalProfileWhereInput> = {
  low: { rateMaxCents: { lte: 900_000 } },
  mid: { rateMinCents: { gte: 200_000 }, rateMaxCents: { lte: 1_200_000 } },
  high: { rateMinCents: { gte: 500_000 } },
};

export interface ProfessionalListResult {
  items: ProfessionalCard[];
  total: number;
  page: number;
  pageCount: number;
}

export async function listProfessionals(
  filters: ProfessionalFilters
): Promise<ProfessionalListResult> {
  const where: Prisma.ProfessionalProfileWhereInput = {
    deletedAt: null,
    user: { status: 'ACTIVE', deletedAt: null },
  };

  if (filters.field && filters.field !== 'Todas as áreas') {
    where.field = filters.field;
  }

  if (filters.skill && filters.skill !== 'Todas') {
    where.skills = { has: filters.skill };
  }

  if (filters.avail !== 'all') {
    where.availability = filters.avail.toUpperCase() as 'NOW' | 'SOON' | 'FULL';
  }

  if (filters.tier !== 'all') {
    Object.assign(where, TIER_RANGES[filters.tier] ?? {});
  }

  if (filters.q) {
    const q = filters.q;
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { bio: { contains: q, mode: 'insensitive' } },
      { skills: { has: q } },
      { user: { name: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const orderBy: Prisma.ProfessionalProfileOrderByWithRelationInput[] =
    filters.sort === 'rating'
      ? [{ ratingSum: 'desc' }, { ratingCount: 'desc' }]
      : filters.sort === 'projects'
        ? [{ projectsCount: 'desc' }]
        : filters.sort === 'avail'
          ? [{ availability: 'asc' }, { ratingSum: 'desc' }]
          : [{ verified: 'desc' }, { projectsCount: 'desc' }];

  const skip = (filters.page - 1) * PRO_PAGE_SIZE;

  const [rows, total] = await Promise.all([
    db.professionalProfile.findMany({
      where,
      select: cardSelect,
      orderBy,
      take: PRO_PAGE_SIZE,
      skip,
    }),
    db.professionalProfile.count({ where }),
  ]);

  // Exact average-rating filter over one page only.
  const items =
    filters.rating === 'all'
      ? rows
      : rows.filter(
          (p) =>
            p.ratingCount > 0 &&
            p.ratingSum / p.ratingCount >= Number(filters.rating)
        );

  return {
    items,
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / PRO_PAGE_SIZE)),
  };
}

export async function getProfessionalBySlug(slug: string) {
  return db.professionalProfile.findFirst({
    where: {
      slug,
      deletedAt: null,
      user: { status: 'ACTIVE', deletedAt: null },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          createdAt: true,
          profile: { select: { headline: true, avatarKey: true, website: true } },
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
            take: 6,
          },
        },
      },
      portfolio: { orderBy: { position: 'asc' } },
      services: { orderBy: { fromCents: 'asc' } },
    },
  });
}

/** Distinct fields with counts, for the filter sidebar. */
export async function getProfessionalFacets() {
  const rows = await db.professionalProfile.groupBy({
    by: ['field'],
    where: { deletedAt: null, user: { status: 'ACTIVE', deletedAt: null } },
    _count: { field: true },
    orderBy: { _count: { field: 'desc' } },
  });

  return rows.map((r) => ({ field: r.field, count: r._count.field }));
}

export async function getFeaturedProfessionals(limit = 3) {
  return db.professionalProfile.findMany({
    where: {
      deletedAt: null,
      verified: true,
      user: { status: 'ACTIVE', deletedAt: null },
    },
    select: cardSelect,
    orderBy: [{ projectsCount: 'desc' }],
    take: limit,
  });
}

export function ratingLabel(sum: number, count: number): string | null {
  if (count === 0) return null;
  return (sum / count).toFixed(1).replace('.', ',');
}
