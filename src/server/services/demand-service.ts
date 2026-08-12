import 'server-only';
import { db, type Prisma } from '@/server/db/client';
import { assertOwnership, requirePermission, requireUser } from '@/server/auth/rbac';
import { audit } from '@/server/security/audit';
import { enforceRateLimit } from '@/server/security/rate-limit';
import { conflict, forbidden, notFound, validation } from '@/lib/errors';
import { slugify } from '@/lib/validation/common';
import type { z } from 'zod';
import type {
  createDemandSchema,
  createProposalSchema,
} from '@/lib/validation/schemas';

/**
 * Demands and proposals — the hiring side of the marketplace.
 *
 * The trust rules here mirror the product side: a demand is owned by its
 * buyer, a proposal by its professional, and only the demand's owner may
 * accept or reject. Every state change is audited because these records
 * become the basis of a paid engagement.
 */

export const DEMAND_PAGE_SIZE = 10;

export async function listOpenDemands(page = 1, category?: string) {
  const where: Prisma.DemandWhereInput = {
    deletedAt: null,
    status: { in: ['OPEN', 'IN_REVIEW'] },
    ...(category && category !== 'Todas' ? { category } : {}),
  };

  const [items, total] = await Promise.all([
    db.demand.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        category: true,
        problem: true,
        tools: true,
        budgetMinCents: true,
        budgetMaxCents: true,
        deadlineWeeks: true,
        proposalCount: true,
        status: true,
        createdAt: true,
        buyer: { select: { name: true, profile: { select: { company: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: DEMAND_PAGE_SIZE,
      skip: (page - 1) * DEMAND_PAGE_SIZE,
    }),
    db.demand.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / DEMAND_PAGE_SIZE)),
  };
}

/**
 * Demand detail.
 *
 * Proposals are visible only to the demand's owner and to the professional who
 * wrote each one. A browsing professional sees the demand and the proposal
 * *count*, never a competitor's price or approach.
 */
export async function getDemand(idOrSlug: string) {
  const viewer = await requireUser().catch(() => null);

  const demand = await db.demand.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      deletedAt: null,
    },
    include: {
      buyer: {
        select: {
          id: true,
          name: true,
          createdAt: true,
          profile: { select: { company: true, location: true } },
        },
      },
    },
  });

  if (!demand) throw notFound('Demanda não encontrada.');

  const isOwner = viewer?.id === demand.buyerId;
  const isAdmin = viewer?.roles.includes('ADMIN') ?? false;

  const proposals = viewer
    ? await db.proposal.findMany({
        where: {
          demandId: demand.id,
          // Owner and admin see everything; a professional sees only their own.
          ...(isOwner || isAdmin ? {} : { authorId: viewer.id }),
        },
        include: {
          professional: {
            select: {
              slug: true,
              verified: true,
              ratingSum: true,
              ratingCount: true,
              projectsCount: true,
              user: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  return { demand, proposals, isOwner, canSeeAllProposals: isOwner || isAdmin };
}

async function uniqueDemandSlug(title: string): Promise<string> {
  const base = slugify(title) || 'demanda';
  for (let i = 0; i < 5; i += 1) {
    const candidate = i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 7)}`;
    const found = await db.demand.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!found) return candidate;
  }
  throw conflict('Não foi possível gerar um endereço único para esta demanda.');
}

export async function createDemand(
  input: z.infer<typeof createDemandSchema>
): Promise<{ id: string; slug: string }> {
  const user = await requirePermission('demand:create');
  await enforceRateLimit('demand', user.id);

  const slug = await uniqueDemandSlug(input.title);

  return db.$transaction(async (tx) => {
    const demand = await tx.demand.create({
      data: {
        slug,
        // Owner is the session user, never a request field.
        buyerId: user.id,
        title: input.title,
        problem: input.problem,
        goal: input.goal,
        details: input.details,
        category: input.category,
        tools: input.tools,
        budgetMinCents: input.budgetMinCents,
        budgetMaxCents: input.budgetMaxCents,
        deadlineWeeks: input.deadlineWeeks,
        status: 'OPEN',
      },
      select: { id: true, slug: true },
    });

    await audit(
      {
        actorId: user.id,
        action: 'demand.created',
        entityType: 'Demand',
        entityId: demand.id,
        metadata: { title: input.title },
      },
      tx
    );

    return demand;
  });
}

export async function createProposal(
  input: z.infer<typeof createProposalSchema>
): Promise<{ id: string }> {
  const user = await requirePermission('proposal:create');
  await enforceRateLimit('proposal', user.id);

  const professional = await db.professionalProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (!professional) {
    throw validation(
      'Complete seu perfil profissional antes de enviar propostas.'
    );
  }

  const demand = await db.demand.findFirst({
    where: { id: input.demandId, deletedAt: null },
    select: { id: true, status: true, buyerId: true, title: true },
  });

  if (!demand) throw notFound('Demanda não encontrada.');

  if (demand.status !== 'OPEN' && demand.status !== 'IN_REVIEW') {
    throw conflict('Esta demanda não está mais recebendo propostas.');
  }

  if (demand.buyerId === user.id) {
    throw validation('Você não pode enviar proposta para a sua própria demanda.');
  }

  const existing = await db.proposal.findUnique({
    where: {
      demandId_professionalId: {
        demandId: demand.id,
        professionalId: professional.id,
      },
    },
    select: { id: true },
  });

  if (existing) throw conflict('Você já enviou uma proposta para esta demanda.');

  return db.$transaction(async (tx) => {
    const proposal = await tx.proposal.create({
      data: {
        demandId: demand.id,
        professionalId: professional.id,
        authorId: user.id,
        priceCents: input.priceCents,
        deliveryWeeks: input.deliveryWeeks,
        approach: input.approach,
        deliverables: input.deliverables,
        notes: input.notes || null,
      },
      select: { id: true },
    });

    await tx.demand.update({
      where: { id: demand.id },
      data: { proposalCount: { increment: 1 } },
    });

    await tx.notification.create({
      data: {
        userId: demand.buyerId,
        type: 'PROPOSAL_RECEIVED',
        title: 'Nova proposta recebida',
        body: `${user.name} enviou uma proposta para "${demand.title}".`,
        href: `/demands/${demand.id}`,
      },
    });

    await audit(
      {
        actorId: user.id,
        action: 'proposal.created',
        entityType: 'Proposal',
        entityId: proposal.id,
        metadata: { demandId: demand.id, priceCents: input.priceCents },
      },
      tx
    );

    return proposal;
  });
}

/**
 * Accept or reject a proposal.
 *
 * Only the demand's owner may decide. Accepting one proposal rejects the
 * others and closes the demand, all in one transaction so the demand can never
 * end up with two accepted proposals.
 */
export async function respondToProposal(
  proposalId: string,
  decision: 'accept' | 'reject'
): Promise<void> {
  const user = await requirePermission('proposal:respond');

  const proposal = await db.proposal.findUnique({
    where: { id: proposalId },
    select: {
      id: true,
      status: true,
      authorId: true,
      demandId: true,
      demand: { select: { id: true, buyerId: true, title: true, status: true } },
    },
  });

  if (!proposal) throw notFound('Proposta não encontrada.');

  // The decision belongs to whoever published the demand.
  assertOwnership(user, proposal.demand.buyerId, {
    entityType: 'Proposal',
    entityId: proposalId,
  });

  if (proposal.status !== 'SENT') {
    throw conflict('Esta proposta já foi respondida.');
  }

  await db.$transaction(async (tx) => {
    await tx.proposal.update({
      where: { id: proposalId },
      data: {
        status: decision === 'accept' ? 'ACCEPTED' : 'REJECTED',
        respondedAt: new Date(),
      },
    });

    if (decision === 'accept') {
      // Everything else on this demand is declined at the same moment.
      await tx.proposal.updateMany({
        where: {
          demandId: proposal.demandId,
          id: { not: proposalId },
          status: 'SENT',
        },
        data: { status: 'REJECTED', respondedAt: new Date() },
      });

      await tx.demand.update({
        where: { id: proposal.demandId },
        data: { status: 'AWARDED' },
      });
    }

    await tx.notification.create({
      data: {
        userId: proposal.authorId,
        type: decision === 'accept' ? 'PROPOSAL_ACCEPTED' : 'PROPOSAL_REJECTED',
        title:
          decision === 'accept'
            ? 'Sua proposta foi aceita'
            : 'Sua proposta não foi selecionada',
        body: `Demanda: ${proposal.demand.title}`,
        href: `/demands/${proposal.demandId}`,
      },
    });

    await audit(
      {
        actorId: user.id,
        action: decision === 'accept' ? 'proposal.accepted' : 'proposal.rejected',
        entityType: 'Proposal',
        entityId: proposalId,
        metadata: { demandId: proposal.demandId },
      },
      tx
    );
  });
}

/** Demands published by the current user. */
export async function listOwnDemands(userId: string) {
  return db.demand.findMany({
    where: { buyerId: userId, deletedAt: null },
    select: {
      id: true,
      slug: true,
      title: true,
      category: true,
      status: true,
      budgetMinCents: true,
      budgetMaxCents: true,
      deadlineWeeks: true,
      proposalCount: true,
      createdAt: true,
      tools: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/** Proposals written by the current professional. */
export async function listOwnProposals(userId: string) {
  return db.proposal.findMany({
    where: { authorId: userId },
    select: {
      id: true,
      status: true,
      priceCents: true,
      deliveryWeeks: true,
      createdAt: true,
      demand: {
        select: { id: true, slug: true, title: true, status: true, category: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/** Withdraw a proposal that has not yet been answered. */
export async function withdrawProposal(proposalId: string): Promise<void> {
  const user = await requireUser();

  const proposal = await db.proposal.findUnique({
    where: { id: proposalId },
    select: { id: true, authorId: true, status: true, demandId: true },
  });

  if (!proposal) throw notFound('Proposta não encontrada.');
  if (proposal.authorId !== user.id) throw forbidden();
  if (proposal.status !== 'SENT') {
    throw conflict('Esta proposta não pode mais ser retirada.');
  }

  await db.$transaction(async (tx) => {
    await tx.proposal.update({
      where: { id: proposalId },
      data: { status: 'WITHDRAWN', respondedAt: new Date() },
    });

    await tx.demand.update({
      where: { id: proposal.demandId },
      data: { proposalCount: { decrement: 1 } },
    });

    await audit(
      {
        actorId: user.id,
        action: 'proposal.withdrawn',
        entityType: 'Proposal',
        entityId: proposalId,
      },
      tx
    );
  });
}
