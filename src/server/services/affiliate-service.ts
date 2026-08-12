import 'server-only';
import { randomInt } from 'node:crypto';
import type { AffiliateStatus, Prisma } from '@prisma/client';
import { db } from '@/server/db/client';
import { requirePermission } from '@/server/auth/rbac';
import { audit } from '@/server/security/audit';
import { conflict, forbidden, notFound, validation } from '@/lib/errors';
import { isWithinWindow } from '@/lib/affiliate';
import { log } from '@/lib/logger';

/**
 * Affiliate programme.
 *
 * The money rule that everything else follows from: an affiliate commission is
 * paid out of the seller's share, never out of the platform fee. A creator
 * choosing a 30% commission is choosing to keep 55% instead of 85% — the
 * platform's 15% is untouched, so the marketplace has no incentive to push
 * rates in either direction and the maths stays legible to sellers.
 */

const logger = log('affiliate-service');

/** Refund window. A commission is only payable once it has closed. */
const HOLD_DAYS = 15;

/**
 * Codes are generated, never chosen.
 *
 * A chosen code invites impersonation ("oficial-lucas") and enumeration of a
 * competitor's programme. The alphabet drops the characters that get misread
 * out loud or in a screenshot — 0/O, 1/I/L — because these end up in URLs that
 * people dictate over the phone.
 */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 10;

function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Splits a sale three ways.
 *
 * Rounds the affiliate share down, so a rounding cent always lands with the
 * seller rather than being conjured out of the total. The caller has already
 * computed the platform fee; this only decides how the seller's remainder is
 * divided.
 */
export function splitAffiliateShare(
  sellerCents: number,
  commissionBps: number,
  grossCents: number
): { affiliateCents: number; sellerCents: number } {
  if (!Number.isInteger(grossCents) || grossCents < 0) {
    throw new RangeError('grossCents must be a non-negative integer');
  }
  if (!Number.isInteger(commissionBps) || commissionBps < 0 || commissionBps > 8000) {
    throw new RangeError('commissionBps must be an integer between 0 and 8000');
  }

  const affiliateCents = Math.floor((grossCents * commissionBps) / 10_000);

  // The commission is capped by what the seller actually has. Without this a
  // high commission plus the platform fee could drive the seller negative.
  const capped = Math.min(affiliateCents, sellerCents);

  return { affiliateCents: capped, sellerCents: sellerCents - capped };
}

// ---------------------------------------------------------------------------
// Programme management (creator side)
// ---------------------------------------------------------------------------

export interface ProgramInput {
  enabled: boolean;
  commissionBps: number;
  cookieDays: number;
  autoApprove: boolean;
  terms?: string | null;
}

/** Creates or updates the programme for one of the caller's own products. */
export async function saveProgram(productId: string, input: ProgramInput) {
  const user = await requirePermission('affiliate:program:manage');

  const product = await db.product.findFirst({
    where: { id: productId, deletedAt: null },
    select: { id: true, authorId: true, name: true },
  });

  if (!product) throw notFound('Produto não encontrado.');

  // Ownership is checked here rather than trusted from the form: the product
  // id arrives from the client.
  if (product.authorId !== user.id) {
    throw forbidden('Você só pode configurar programas dos seus produtos.');
  }

  const program = await db.affiliateProgram.upsert({
    where: { productId },
    create: {
      productId,
      ownerId: user.id,
      enabled: input.enabled,
      commissionBps: input.commissionBps,
      cookieDays: input.cookieDays,
      autoApprove: input.autoApprove,
      terms: input.terms ?? null,
    },
    update: {
      enabled: input.enabled,
      commissionBps: input.commissionBps,
      cookieDays: input.cookieDays,
      autoApprove: input.autoApprove,
      terms: input.terms ?? null,
    },
  });

  await audit({
    actorId: user.id,
    action: 'affiliate.program.saved',
    entityType: 'AffiliateProgram',
    entityId: program.id,
    metadata: {
      productId,
      commissionBps: input.commissionBps,
      enabled: input.enabled,
    },
  });

  return program;
}

/** The programme attached to a product, for the public product page. */
export async function getPublicProgram(productId: string) {
  return db.affiliateProgram.findFirst({
    where: { productId, enabled: true },
    select: {
      id: true,
      commissionBps: true,
      cookieDays: true,
      autoApprove: true,
      terms: true,
    },
  });
}

/** Every programme the caller owns, with performance to date. */
export async function listOwnPrograms() {
  const user = await requirePermission('affiliate:program:manage');

  return db.affiliateProgram.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      enabled: true,
      commissionBps: true,
      cookieDays: true,
      autoApprove: true,
      product: { select: { id: true, name: true, slug: true, priceCents: true } },
      _count: { select: { affiliates: true } },
    },
  });
}

/** Affiliates on one of the caller's programmes, pending ones first. */
export async function listProgramAffiliates(programId: string) {
  const user = await requirePermission('affiliate:program:manage');

  const program = await db.affiliateProgram.findUnique({
    where: { id: programId },
    select: { id: true, ownerId: true },
  });

  if (!program) throw notFound('Programa não encontrado.');
  if (program.ownerId !== user.id) throw forbidden();

  return db.affiliate.findMany({
    where: { programId },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      code: true,
      status: true,
      clickCount: true,
      conversionCount: true,
      createdAt: true,
      user: { select: { id: true, name: true } },
    },
  });
}

/** Approve, reject or block an affiliate on the caller's own programme. */
export async function setAffiliateStatus(
  affiliateId: string,
  status: Extract<AffiliateStatus, 'APPROVED' | 'REJECTED' | 'BLOCKED'>
) {
  const user = await requirePermission('affiliate:program:manage');

  const affiliate = await db.affiliate.findUnique({
    where: { id: affiliateId },
    select: { id: true, userId: true, program: { select: { ownerId: true } } },
  });

  if (!affiliate) throw notFound('Afiliado não encontrado.');
  if (affiliate.program.ownerId !== user.id) throw forbidden();

  await db.affiliate.update({
    where: { id: affiliateId },
    data: {
      status,
      approvedAt: status === 'APPROVED' ? new Date() : null,
    },
  });

  // Mapped rather than derived from the status string, so the audit vocabulary
  // stays a closed set the type checker can police.
  const action = {
    APPROVED: 'affiliate.approved',
    REJECTED: 'affiliate.rejected',
    BLOCKED: 'affiliate.blocked',
  } as const;

  await audit({
    actorId: user.id,
    action: action[status],
    entityType: 'Affiliate',
    entityId: affiliateId,
    metadata: { affiliateUserId: affiliate.userId },
  });
}

// ---------------------------------------------------------------------------
// Affiliate side
// ---------------------------------------------------------------------------

/** Joins the programme for a product and returns the referral code. */
export async function joinProgram(productId: string) {
  const user = await requirePermission('affiliate:join');

  const program = await db.affiliateProgram.findFirst({
    where: { productId, enabled: true },
    select: { id: true, ownerId: true, autoApprove: true },
  });

  if (!program) {
    throw notFound('Este produto não tem programa de afiliados ativo.');
  }

  // Self-referral would let a creator take their own commission back out of
  // the platform's accounting for free.
  if (program.ownerId === user.id) {
    throw validation('Você não pode se afiliar ao seu próprio produto.');
  }

  const existing = await db.affiliate.findUnique({
    where: { programId_userId: { programId: program.id, userId: user.id } },
    select: { id: true, code: true, status: true },
  });

  if (existing) {
    if (existing.status === 'BLOCKED' || existing.status === 'REJECTED') {
      throw conflict('Sua participação neste programa não está ativa.');
    }
    return existing;
  }

  const affiliate = await createWithUniqueCode(program.id, user.id, {
    status: program.autoApprove ? 'APPROVED' : 'PENDING',
    approvedAt: program.autoApprove ? new Date() : null,
  });

  await audit({
    actorId: user.id,
    action: 'affiliate.joined',
    entityType: 'Affiliate',
    entityId: affiliate.id,
    metadata: { programId: program.id, productId },
  });

  return affiliate;
}

/**
 * Inserts with a fresh code, retrying on the unique constraint.
 *
 * Retrying on the collision is what makes this correct under concurrency: a
 * pre-flight "is this code taken" check would still race between the read and
 * the insert. Three attempts against a 31^10 space is generous.
 */
async function createWithUniqueCode(
  programId: string,
  userId: string,
  extra: { status: AffiliateStatus; approvedAt: Date | null }
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.affiliate.create({
        data: { programId, userId, code: generateCode(), ...extra },
        select: { id: true, code: true, status: true },
      });
    } catch (error) {
      if (isUniqueViolation(error, 'code') && attempt < 2) {
        logger.warn({ attempt }, 'affiliate code collision, retrying');
        continue;
      }
      throw error;
    }
  }

  // Unreachable: the loop either returns or rethrows.
  throw conflict('Não foi possível gerar um código. Tente novamente.');
}

function isUniqueViolation(error: unknown, field: string): boolean {
  const candidate = error as Prisma.PrismaClientKnownRequestError;
  if (candidate?.code !== 'P2002') return false;
  const target = candidate.meta?.target;
  return Array.isArray(target) ? target.includes(field) : true;
}

/** Everything the caller promotes, with earnings to date. */
export async function listOwnAffiliations(userId: string) {
  const affiliations = await db.affiliate.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      code: true,
      status: true,
      clickCount: true,
      conversionCount: true,
      program: {
        select: {
          commissionBps: true,
          enabled: true,
          product: { select: { name: true, slug: true, priceCents: true } },
        },
      },
    },
  });

  // One grouped aggregate rather than a per-affiliation query: this renders on
  // a dashboard that a heavy affiliate could otherwise turn into an N+1.
  const totals = await db.affiliateCommission.groupBy({
    by: ['affiliateId', 'status'],
    where: { affiliate: { userId } },
    _sum: { amountCents: true },
  });

  const earnings = new Map<string, { pending: number; paid: number }>();
  for (const row of totals) {
    const current = earnings.get(row.affiliateId) ?? { pending: 0, paid: 0 };
    const amount = row._sum.amountCents ?? 0;

    if (row.status === 'PAID') current.paid += amount;
    else if (row.status === 'PENDING' || row.status === 'APPROVED') {
      current.pending += amount;
    }

    earnings.set(row.affiliateId, current);
  }

  return affiliations.map((affiliation) => ({
    ...affiliation,
    earnings: earnings.get(affiliation.id) ?? { pending: 0, paid: 0 },
  }));
}

// ---------------------------------------------------------------------------
// Attribution
// ---------------------------------------------------------------------------

export interface Attribution {
  affiliateId: string;
  commissionBps: number;
}

/**
 * Resolves a referral code against the product being bought.
 *
 * Returns null rather than throwing for every rejection: a stale, revoked or
 * mismatched code must never block a purchase. The buyer gets their product
 * either way; only the commission is lost.
 */
export async function resolveAttribution(
  code: string,
  clickedAt: Date,
  productId: string,
  buyerId: string
): Promise<Attribution | null> {
  if (!code) return null;

  const affiliate = await db.affiliate.findUnique({
    where: { code },
    select: {
      id: true,
      userId: true,
      status: true,
      program: {
        select: {
          productId: true,
          enabled: true,
          commissionBps: true,
          cookieDays: true,
          ownerId: true,
        },
      },
    },
  });

  if (!affiliate) return null;
  if (affiliate.status !== 'APPROVED') return null;
  if (!affiliate.program.enabled) return null;

  // The real attribution window is enforced here, not in the cookie: the
  // creator's current setting wins over whatever was true at click time.
  if (!isWithinWindow(clickedAt, affiliate.program.cookieDays)) return null;

  // The code must belong to the product actually being purchased, or an
  // affiliate could earn on the whole catalogue from one link.
  if (affiliate.program.productId !== productId) return null;

  // Self-purchase through your own link is the oldest commission fraud there
  // is, and a creator must not earn a commission on their own sale.
  if (affiliate.userId === buyerId) return null;
  if (affiliate.program.ownerId === buyerId) return null;

  return {
    affiliateId: affiliate.id,
    commissionBps: affiliate.program.commissionBps,
  };
}

/** Bumps the click counter. Best-effort: a lost click must not break a page. */
export async function recordClick(code: string): Promise<void> {
  try {
    await db.affiliate.updateMany({
      where: { code, status: 'APPROVED' },
      data: { clickCount: { increment: 1 } },
    });
  } catch (error) {
    logger.warn({ err: error }, 'failed to record affiliate click');
  }
}

/**
 * Writes the commission for a settled order line.
 *
 * Called from inside the order settlement transaction, so the commission and
 * the sale commit together. The unique constraint on orderItemId makes a
 * webhook replay a no-op rather than a double payout.
 */
export async function recordCommission(
  tx: Prisma.TransactionClient,
  input: { affiliateId: string; orderItemId: string; amountCents: number }
): Promise<{ affiliateUserId: string } | null> {
  if (input.amountCents <= 0) return null;

  const availableAt = new Date(Date.now() + HOLD_DAYS * 24 * 60 * 60 * 1000);

  await tx.affiliateCommission.upsert({
    where: { orderItemId: input.orderItemId },
    create: {
      affiliateId: input.affiliateId,
      orderItemId: input.orderItemId,
      amountCents: input.amountCents,
      availableAt,
    },
    update: {},
  });

  // Returns the account behind the affiliate row: callers need the user id to
  // notify, and the two are easy to confuse at the call site.
  const affiliate = await tx.affiliate.update({
    where: { id: input.affiliateId },
    data: { conversionCount: { increment: 1 } },
    select: { userId: true },
  });

  return { affiliateUserId: affiliate.userId };
}

/** Reverses commissions for a refunded order. */
export async function reverseCommissionsForOrder(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<void> {
  await tx.affiliateCommission.updateMany({
    where: {
      orderItem: { orderId },
      // A commission already paid out is settled money; reversing it here
      // would silently create a negative balance the affiliate never sees.
      status: { in: ['PENDING', 'APPROVED'] },
    },
    data: { status: 'REVERSED' },
  });
}
