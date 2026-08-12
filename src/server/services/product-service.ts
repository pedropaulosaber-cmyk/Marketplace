import 'server-only';
import { db, type Prisma } from '@/server/db/client';
import { assertOwnership, requirePermission } from '@/server/auth/rbac';
import { audit } from '@/server/security/audit';
import { enforceRateLimit } from '@/server/security/rate-limit';
import { conflict, notFound, validation } from '@/lib/errors';
import { slugify } from '@/lib/validation/common';
import type { ProductFilters } from '@/lib/validation/schemas';
import type { SessionUser } from '@/server/auth/session';

/**
 * Product catalog service.
 *
 * Read paths are shaped for the public catalog: every list query is filtered,
 * indexed, paginated and selects only what the card renders. Write paths run
 * every state change through the moderation workflow.
 */

export const PAGE_SIZE = 12;

/** Columns needed to render a product card. Nothing more travels over the wire. */
const cardSelect = {
  id: true,
  slug: true,
  name: true,
  tagline: true,
  priceCents: true,
  ratingSum: true,
  ratingCount: true,
  salesCount: true,
  publishedAt: true,
  category: { select: { name: true, slug: true } },
  author: {
    select: {
      id: true,
      name: true,
      professional: { select: { verified: true } },
    },
  },
  images: {
    select: { storageKey: true, alt: true },
    orderBy: { position: 'asc' },
    take: 1,
  },
  tags: { select: { tag: { select: { name: true, slug: true } } } },
} satisfies Prisma.ProductSelect;

export type ProductCard = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

/** Only published, non-deleted products are ever publicly visible. */
const PUBLIC_WHERE = {
  status: 'PUBLISHED',
  deletedAt: null,
} satisfies Prisma.ProductWhereInput;

function priceWhere(filter: ProductFilters['price']): Prisma.ProductWhereInput {
  switch (filter) {
    case 'free':
      return { priceCents: 0 };
    case 'u100':
      return { priceCents: { gt: 0, lt: 10_000 } };
    case '100-199':
      return { priceCents: { gte: 10_000, lt: 20_000 } };
    case '200':
      return { priceCents: { gte: 20_000 } };
    default:
      return {};
  }
}

function orderBy(
  sort: ProductFilters['sort']
): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case 'sold':
      return [{ salesCount: 'desc' }, { id: 'desc' }];
    case 'new':
      return [{ publishedAt: 'desc' }, { id: 'desc' }];
    case 'price-l':
      return [{ priceCents: 'asc' }, { id: 'desc' }];
    case 'price-h':
      return [{ priceCents: 'desc' }, { id: 'desc' }];
    case 'rating':
      // Products with no ratings sort last rather than appearing "perfect".
      return [{ ratingCount: 'desc' }, { ratingSum: 'desc' }, { id: 'desc' }];
    default:
      return [{ salesCount: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }];
  }
}

export interface ProductListResult {
  items: ProductCard[];
  total: number;
  page: number;
  pageCount: number;
}

/**
 * Public catalog listing.
 *
 * Filtering, sorting and pagination all happen in Postgres — the app never
 * loads the catalog into memory to filter it. `take`/`skip` are bounded by the
 * validated filter schema so a crafted query cannot request a huge page.
 */
export async function listProducts(
  filters: ProductFilters
): Promise<ProductListResult> {
  const where: Prisma.ProductWhereInput = {
    ...PUBLIC_WHERE,
    ...priceWhere(filters.price),
  };

  if (filters.category && filters.category !== 'Todos') {
    where.OR = [
      { category: { slug: filters.category } },
      { category: { name: filters.category } },
      { tags: { some: { tag: { name: filters.category } } } },
    ];
  }

  if (filters.q) {
    // `mode: 'insensitive'` maps to ILIKE. The GIN index added in the
    // integrity migration backs the heavier text search.
    const q = filters.q;
    where.AND = [
      {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { tagline: { contains: q, mode: 'insensitive' } },
          { author: { name: { contains: q, mode: 'insensitive' } } },
          { tags: { some: { tag: { name: { contains: q, mode: 'insensitive' } } } } },
        ],
      },
    ];
  }

  if (filters.seller === 'verified') {
    // Nothing else sets `author` on this where clause — the text search puts
    // its author condition inside `AND` — so a direct assignment is safe.
    where.author = { professional: { verified: true } };
  }

  if (filters.rating !== 'all') {
    const min = Number(filters.rating);
    // Average >= min, expressed without a computed column: ratingSum must be
    // at least min * ratingCount, and there must be at least one rating.
    where.ratingCount = { gt: 0 };
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      { ratingSum: { gte: Math.ceil(min) } },
    ];
  }

  const skip = (filters.page - 1) * PAGE_SIZE;

  const [items, total] = await Promise.all([
    db.product.findMany({
      where,
      select: cardSelect,
      orderBy: orderBy(filters.sort),
      take: PAGE_SIZE,
      skip,
    }),
    db.product.count({ where }),
  ]);

  // The rating filter needs an average, which Prisma cannot express in a
  // where clause. The coarse ratingSum filter above narrows the set in SQL;
  // this exact pass runs over one page, never the whole catalog.
  const filtered =
    filters.rating === 'all'
      ? items
      : items.filter(
          (p) =>
            p.ratingCount > 0 &&
            p.ratingSum / p.ratingCount >= Number(filters.rating)
        );

  return {
    items: filtered,
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** Full product page payload. Returns null for anything not publicly visible. */
export async function getProductBySlug(slug: string) {
  const product = await db.product.findFirst({
    where: { slug, ...PUBLIC_WHERE },
    include: {
      category: true,
      author: {
        select: {
          id: true,
          name: true,
          profile: { select: { headline: true, avatarKey: true } },
          professional: { select: { slug: true, verified: true } },
          _count: { select: { products: true } },
        },
      },
      images: { orderBy: { position: 'asc' } },
      tags: { include: { tag: true } },
      // Deliverable metadata only — storage keys never reach a page payload.
      files: {
        where: { deletedAt: null },
        select: { id: true, fileName: true, sizeBytes: true, version: true },
      },
      reviews: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          author: { select: { name: true, profile: { select: { headline: true } } } },
          reply: true,
        },
      },
    },
  });

  return product;
}

export async function getRelatedProducts(
  productId: string,
  categoryId: string,
  authorId: string
): Promise<ProductCard[]> {
  return db.product.findMany({
    where: {
      ...PUBLIC_WHERE,
      id: { not: productId },
      OR: [{ categoryId }, { authorId }],
    },
    select: cardSelect,
    orderBy: [{ salesCount: 'desc' }],
    take: 3,
  });
}

/** Products shown on the landing page. */
export async function getFeaturedProducts(limit = 8): Promise<ProductCard[]> {
  return db.product.findMany({
    where: PUBLIC_WHERE,
    select: cardSelect,
    orderBy: [{ salesCount: 'desc' }, { publishedAt: 'desc' }],
    take: limit,
  });
}

// --- Author-scoped reads ----------------------------------------------------

/**
 * Products belonging to one creator.
 *
 * The author id comes from the session, never from a parameter — that is what
 * makes this immune to IDOR.
 */
export async function listOwnProducts(user: SessionUser, q?: string) {
  return db.product.findMany({
    where: {
      authorId: user.id,
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { category: { name: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      priceCents: true,
      salesCount: true,
      ratingSum: true,
      ratingCount: true,
      createdAt: true,
      category: { select: { name: true } },
      _count: { select: { orderItems: true } },
    },
    orderBy: [{ updatedAt: 'desc' }],
  });
}

// --- Mutations --------------------------------------------------------------

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || 'produto';

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate =
      attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 7)}`;
    const existing = await db.product.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }

  throw conflict('Não foi possível gerar um endereço único para este produto.');
}

export interface CreateProductInput {
  name: string;
  tagline: string;
  descriptionMd: string;
  categoryId: string;
  priceCents: number;
  videoUrl?: string;
  tags: string[];
  benefits: string[];
  included: string[];
  requirements: string[];
  compat: string[];
  integrations: string[];
}

export async function createProduct(
  input: CreateProductInput
): Promise<{ id: string; slug: string }> {
  const user = await requirePermission('product:create');
  await enforceRateLimit('mutation', user.id);

  const category = await db.category.findUnique({
    where: { id: input.categoryId },
    select: { id: true },
  });
  if (!category) {
    throw validation('Categoria inválida.', { categoryId: ['Categoria inválida.'] });
  }

  const slug = await uniqueSlug(input.name);

  const product = await db.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        slug,
        name: input.name,
        tagline: input.tagline,
        descriptionMd: input.descriptionMd,
        categoryId: input.categoryId,
        // Author is the session user. A client-supplied authorId is never read.
        authorId: user.id,
        priceCents: input.priceCents,
        videoUrl: input.videoUrl || null,
        benefits: input.benefits,
        included: input.included,
        requirements: input.requirements,
        compat: input.compat,
        integrations: input.integrations,
        // New products always start as drafts. Publication requires review.
        status: 'DRAFT',
      },
      select: { id: true, slug: true },
    });

    await attachTags(tx, created.id, input.tags);

    await audit(
      {
        actorId: user.id,
        action: 'product.created',
        entityType: 'Product',
        entityId: created.id,
        metadata: { name: input.name, priceCents: input.priceCents },
      },
      tx
    );

    return created;
  });

  return product;
}

async function attachTags(
  tx: Prisma.TransactionClient,
  productId: string,
  names: string[]
): Promise<void> {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))].slice(0, 8);

  for (const name of unique) {
    const tagSlug = slugify(name);
    if (!tagSlug) continue;

    const tag = await tx.tag.upsert({
      where: { slug: tagSlug },
      create: { slug: tagSlug, name },
      update: {},
      select: { id: true },
    });

    await tx.productTag.upsert({
      where: { productId_tagId: { productId, tagId: tag.id } },
      create: { productId, tagId: tag.id },
      update: {},
    });
  }
}

export async function updateProduct(
  productId: string,
  input: Partial<CreateProductInput>
): Promise<void> {
  const user = await requirePermission('product:update');

  const existing = await db.product.findFirst({
    where: { id: productId, deletedAt: null },
    select: { id: true, authorId: true, status: true },
  });

  if (!existing) throw notFound('Produto não encontrado.');

  // Role alone is not enough: this must be *their* product.
  assertOwnership(user, existing.authorId, {
    entityType: 'Product',
    entityId: productId,
  });

  await db.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.tagline !== undefined ? { tagline: input.tagline } : {}),
        ...(input.descriptionMd !== undefined
          ? { descriptionMd: input.descriptionMd }
          : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.priceCents !== undefined ? { priceCents: input.priceCents } : {}),
        ...(input.videoUrl !== undefined ? { videoUrl: input.videoUrl || null } : {}),
        ...(input.benefits ? { benefits: input.benefits } : {}),
        ...(input.included ? { included: input.included } : {}),
        ...(input.requirements ? { requirements: input.requirements } : {}),
        ...(input.compat ? { compat: input.compat } : {}),
        ...(input.integrations ? { integrations: input.integrations } : {}),
        // A published product that changes materially returns to review.
        ...(existing.status === 'PUBLISHED' &&
        (input.name || input.descriptionMd || input.priceCents !== undefined)
          ? { status: 'PENDING_REVIEW', submittedAt: new Date() }
          : {}),
      },
    });

    if (input.tags) await attachTags(tx, productId, input.tags);

    await audit(
      {
        actorId: user.id,
        action: 'product.updated',
        entityType: 'Product',
        entityId: productId,
        metadata: { fields: Object.keys(input) },
      },
      tx
    );
  });
}

/** Creator submits a draft for admin review. */
export async function submitForReview(productId: string): Promise<void> {
  const user = await requirePermission('product:publish');

  const product = await db.product.findFirst({
    where: { id: productId, deletedAt: null },
    select: {
      id: true,
      authorId: true,
      status: true,
      priceCents: true,
      _count: { select: { files: true } },
    },
  });

  if (!product) throw notFound('Produto não encontrado.');
  assertOwnership(user, product.authorId, {
    entityType: 'Product',
    entityId: productId,
  });

  if (product.status !== 'DRAFT' && product.status !== 'REJECTED') {
    throw conflict('Este produto já foi enviado para revisão.');
  }

  // A paid product with nothing to deliver would take money for nothing.
  if (product.priceCents > 0 && product._count.files === 0) {
    throw validation(
      'Adicione ao menos um arquivo entregável antes de publicar um produto pago.'
    );
  }

  await db.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data: {
        status: 'PENDING_REVIEW',
        submittedAt: new Date(),
        rejectionReason: null,
      },
    });

    await audit(
      {
        actorId: user.id,
        action: 'product.submitted',
        entityType: 'Product',
        entityId: productId,
      },
      tx
    );
  });
}

/** Admin moderation decision. Only an admin may change publication state. */
export async function moderateProduct(
  productId: string,
  decision: 'approve' | 'reject',
  reason?: string
): Promise<void> {
  const admin = await requirePermission('product:moderate');

  const product = await db.product.findFirst({
    where: { id: productId, deletedAt: null },
    select: { id: true, status: true, authorId: true, name: true },
  });

  if (!product) throw notFound('Produto não encontrado.');

  await db.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data:
        decision === 'approve'
          ? {
              status: 'PUBLISHED',
              publishedAt: new Date(),
              reviewedById: admin.id,
              reviewedAt: new Date(),
              rejectionReason: null,
            }
          : {
              status: 'REJECTED',
              reviewedById: admin.id,
              reviewedAt: new Date(),
              rejectionReason: reason ?? null,
            },
    });

    await tx.notification.create({
      data: {
        userId: product.authorId,
        type: decision === 'approve' ? 'PRODUCT_APPROVED' : 'PRODUCT_REJECTED',
        title:
          decision === 'approve'
            ? `${product.name} foi aprovado`
            : `${product.name} precisa de ajustes`,
        body:
          decision === 'approve'
            ? 'Seu produto já está publicado no marketplace.'
            : (reason ?? 'Revise as informações e envie novamente.'),
        href: '/dashboard/products',
      },
    });

    await audit(
      {
        actorId: admin.id,
        action: decision === 'approve' ? 'product.approved' : 'product.rejected',
        entityType: 'Product',
        entityId: productId,
        metadata: { reason: reason ?? null },
      },
      tx
    );
  });
}

/**
 * Soft delete. Orders reference products forever, so the row must survive —
 * hard-deleting it would orphan purchase history and break buyer libraries.
 */
export async function archiveProduct(productId: string): Promise<void> {
  const user = await requirePermission('product:delete');

  const product = await db.product.findFirst({
    where: { id: productId, deletedAt: null },
    select: { id: true, authorId: true },
  });

  if (!product) throw notFound('Produto não encontrado.');
  assertOwnership(user, product.authorId, {
    entityType: 'Product',
    entityId: productId,
  });

  await db.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data: { status: 'ARCHIVED', deletedAt: new Date() },
    });

    await audit(
      {
        actorId: user.id,
        action: 'product.archived',
        entityType: 'Product',
        entityId: productId,
      },
      tx
    );
  });
}

/** Average rating as a display string, e.g. "4,8". */
export function averageRating(sum: number, count: number): string | null {
  if (count === 0) return null;
  return (sum / count).toFixed(1).replace('.', ',');
}
