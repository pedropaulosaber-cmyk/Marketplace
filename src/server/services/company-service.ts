import 'server-only';
import { db, type Prisma } from '@/server/db/client';

/**
 * Partner company storefronts.
 *
 * Companies are curated, not self-registered — see the schema comment on
 * `Company`. This is a small, editorially-managed list, not a paginated
 * directory, so there is no filter/sort surface to mirror from the catalog
 * here — just soft-delete-aware listing and lookup.
 */

const cardSelect = {
  id: true,
  slug: true,
  name: true,
  tagline: true,
  location: true,
  featured: true,
} satisfies Prisma.CompanySelect;

export type CompanyCard = Prisma.CompanyGetPayload<{ select: typeof cardSelect }>;

/** Featured partners first, then alphabetical — same ordering as the demo data. */
export async function listCompanies(): Promise<CompanyCard[]> {
  return db.company.findMany({
    where: { deletedAt: null },
    select: cardSelect,
    orderBy: [{ featured: 'desc' }, { name: 'asc' }],
  });
}

const productCardSelect = {
  id: true,
  slug: true,
  name: true,
  tagline: true,
  priceCents: true,
  ratingSum: true,
  ratingCount: true,
  category: { select: { name: true } },
  author: { select: { name: true } },
} satisfies Prisma.ProductSelect;

export async function getCompanyBySlug(slug: string) {
  return db.company.findFirst({
    where: { slug, deletedAt: null },
    include: {
      products: {
        where: { status: 'PUBLISHED', deletedAt: null },
        select: productCardSelect,
        orderBy: { salesCount: 'desc' },
      },
    },
  });
}
